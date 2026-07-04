import 'dart:io';

import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  const AppConfig._();

  static const bool useMockData = false;

  /// Set to true to run the Learning Hub on mock data (no backend needed).
  /// Flip to false once the elearning-service is live.
  static const bool useMockElearning = false;
  static const String appName = 'Kilimanjaro Schools';
  static const String minRequiredVersion = '1.0.0';

  static String get apiBaseUrl {
    // Android emulator routes 10.0.2.2 to the host machine.
    // iOS simulator and web can use localhost directly.
    if (Platform.isAndroid) {
      return dotenv.env['API_BASE_URL_ANDROID'] ??
          dotenv.env['API_BASE_URL'] ??
          'http://10.0.2.2:3000';
    }
    return dotenv.env['API_BASE_URL'] ?? 'http://localhost:3000';
  }
}
