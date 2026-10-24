import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import 'push_registration_service.dart';
import 'push_service.dart';

/// The active push transport. Swap [NoopPushService] for the concrete FCM
/// implementation once Firebase is configured (see `docs/mobile-fcm-setup.md`).
final pushServiceProvider = Provider<PushService>((ref) => NoopPushService());

final pushRegistrationServiceProvider =
    Provider<PushRegistrationService>((ref) {
  return PushRegistrationService(ref.watch(secureStorageProvider));
});

/// Coordinates the push lifecycle with authentication and routing:
///  * after login → init, request permission, fetch token, register it, and
///    keep it fresh on rotation;
///  * on logout → revoke and delete the token;
///  * on notification tap → hand the route to [onRoute].
///
/// All steps are best-effort: a failure to register a token never breaks the
/// authenticated experience.
class PushCoordinator {
  PushCoordinator(this._ref);

  final Ref _ref;
  StreamSubscription<String>? _refreshSub;
  String? _currentToken;

  PushService get _push => _ref.read(pushServiceProvider);
  PushRegistrationService get _registrar =>
      _ref.read(pushRegistrationServiceProvider);

  /// Wire this to navigation so a tapped notification opens the right screen.
  void Function(String route)? onRoute;

  Future<void> onAuthenticated() async {
    try {
      await _push.init();
      _push.onMessageOpened = _handleMessage;
      final granted = await _push.requestPermission();
      if (!granted) return;
      final token = await _push.currentToken();
      if (token != null) {
        _currentToken = token;
        await _registrar.register(token);
      }
      _refreshSub ??= _push.onTokenRefresh.listen((token) async {
        _currentToken = token;
        try {
          await _registrar.register(token);
        } catch (e) {
          _log('token refresh registration failed: $e');
        }
      });
    } catch (e) {
      _log('push setup failed: $e');
    }
  }

  Future<void> onLoggedOut() async {
    final token = _currentToken;
    try {
      if (token != null) await _registrar.unregister(token);
      await _push.deleteToken();
    } catch (e) {
      _log('push teardown failed: $e');
    } finally {
      _currentToken = null;
      await _refreshSub?.cancel();
      _refreshSub = null;
    }
  }

  void _handleMessage(PushMessage message) {
    final route = message.deepLinkRoute ?? _routeForEntity(message);
    if (route != null) onRoute?.call(route);
  }

  /// Maps a notification's entity to an in-app route when the backend did not
  /// supply an explicit one.
  String? _routeForEntity(PushMessage message) {
    final id = message.entityId;
    switch (message.entityType) {
      case 'result':
        return id != null ? '/student/results/$id' : '/student/results';
      case 'invoice':
        return id != null ? '/student/finance/invoice/$id' : '/student/finance';
      case 'announcement':
        return '/notifications';
      case 'task':
        return '/notifications';
      default:
        return null;
    }
  }

  void _log(String message) {
    if (kDebugMode) debugPrint('[PushCoordinator] $message');
  }
}

final pushCoordinatorProvider = Provider<PushCoordinator>((ref) {
  return PushCoordinator(ref);
});
