import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/providers/error_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');

  final container = ProviderContainer();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (kDebugMode) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      container.read(errorControllerProvider.notifier).reportError(details);
    });
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('PlatformError: $error');
    return true;
  };

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const KilimanjaroApp(),
    ),
  );
}
