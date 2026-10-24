import 'package:flutter/foundation.dart';

/// A push notification payload normalized from the transport (FCM) into
/// something the app can deep-link on.
class PushMessage {
  const PushMessage({
    required this.data,
    this.title,
    this.body,
  });

  final Map<String, String> data;
  final String? title;
  final String? body;

  /// The in-app route to open when the notification is tapped, if the backend
  /// included one (e.g. `/student/results/term-3`).
  String? get deepLinkRoute => data['route'] ?? data['deepLink'];

  /// The domain entity the notification refers to, for routing when no explicit
  /// route is supplied (`result`, `invoice`, `announcement`, `task`).
  String? get entityType => data['type'] ?? data['entityType'];
  String? get entityId => data['id'] ?? data['entityId'];
}

typedef PushMessageHandler = void Function(PushMessage message);

/// Transport-agnostic push interface. The app depends on this; the concrete
/// FCM implementation is swapped in once Firebase is configured (see
/// `docs/mobile-fcm-setup.md`). Until then [NoopPushService] keeps the app
/// fully functional with push simply inert.
abstract class PushService {
  /// Initializes the transport and permission state. Safe to call once at
  /// startup and again after login.
  Future<void> init();

  /// Prompts for notification permission at the right moment in the journey
  /// (after first successful login, not on cold start). Returns whether it is
  /// granted.
  Future<bool> requestPermission();

  /// The current device token, or null when unavailable/denied.
  Future<String?> currentToken();

  /// Emits a new token whenever the transport rotates it.
  Stream<String> get onTokenRefresh;

  /// Called when a notification is tapped (background/terminated) or received
  /// in the foreground and should route.
  set onMessageOpened(PushMessageHandler handler);

  /// Releases the token on logout so the device stops receiving the previous
  /// user's notifications.
  Future<void> deleteToken();
}

/// The default, build-safe implementation. Does nothing except record intent,
/// so the app compiles and runs without any Firebase configuration.
class NoopPushService implements PushService {
  PushMessageHandler? _handler;

  @override
  Future<void> init() async {
    if (kDebugMode) {
      debugPrint('[Push] NoopPushService active — FCM not configured yet.');
    }
  }

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<String?> currentToken() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream<String>.empty();

  @override
  set onMessageOpened(PushMessageHandler handler) => _handler = handler;

  PushMessageHandler? get handler => _handler;

  @override
  Future<void> deleteToken() async {}
}
