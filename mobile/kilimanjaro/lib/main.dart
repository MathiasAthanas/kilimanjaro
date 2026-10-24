import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/network/error_monitor.dart';
import 'core/providers/error_provider.dart';

/// Selects the environment file at build time:
///   flutter run --dart-define=ENV=staging     -> .env.staging
///   flutter build apk --dart-define=ENV=production -> .env.production
/// Defaults to `.env` for local development.
const String _environment = String.fromEnvironment('ENV', defaultValue: 'local');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _loadEnvironment();

  // Fail loudly on a release build that would ship a localhost or non-HTTPS
  // API URL, rather than silently pointing at the wrong host.
  AppConfig.assertValidConfig();

  final container = ProviderContainer(
    observers: !kReleaseMode ? [_DebugProviderObserver()] : const [],
  );

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (kDebugMode) return;
    ErrorMonitor.instance.captureException(
      details.exception,
      details.stack ?? StackTrace.current,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      container.read(errorControllerProvider.notifier).reportError(details);
    });
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    ErrorMonitor.instance.captureException(error, stack);
    return true;
  };

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const KilimanjaroApp(),
    ),
  );
}

Future<void> _loadEnvironment() async {
  final fileName = switch (_environment) {
    'production' => '.env.production',
    'staging' => '.env.staging',
    _ => '.env',
  };
  try {
    await dotenv.load(fileName: fileName);
  } catch (_) {
    // The selected file may be absent on a fresh checkout. Fall back to `.env`
    // so local development still works; release validation runs regardless.
    if (fileName != '.env') {
      try {
        await dotenv.load(fileName: '.env');
      } catch (_) {
        dotenv.testLoad(fileInput: '');
      }
    } else {
      dotenv.testLoad(fileInput: '');
    }
  }
}

/// Debug-only: surfaces provider failures (parse errors, failed loads) that the
/// UI otherwise collapses into a generic "something went wrong" state.
class _DebugProviderObserver extends ProviderObserver {
  int _updates = 0;

  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    _updates++;
    if (_updates % 25 == 0) {
      debugPrint('[DBG] provider updates: $_updates last=${provider.name ?? provider.runtimeType}');
    }
  }

  @override
  void providerDidFail(
    ProviderBase<Object?> provider,
    Object error,
    StackTrace stackTrace,
    ProviderContainer container,
  ) {
    debugPrint('[ProviderError] ${provider.name ?? provider.runtimeType}: $error');
    debugPrint(stackTrace.toString().split('\n').take(4).join('\n'));
  }
}
