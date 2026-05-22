import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  const AppConfig._();

  static const bool useMockData = true;
  static const String appName = 'Kilimanjaro Schools';
  static const String minRequiredVersion = '1.0.0';

  static String get apiBaseUrl =>
      dotenv.env['API_BASE_URL'] ?? 'http://localhost:3000';
}
