import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Raised when the app is built for release with an unsafe API configuration.
class InvalidApiConfigException implements Exception {
  const InvalidApiConfigException(this.message);
  final String message;
  @override
  String toString() => 'InvalidApiConfigException: $message';
}

class AppConfig {
  const AppConfig._();

  static const bool useMockData = false;

  /// Set to true to run the Learning Hub on mock data (no backend needed).
  /// Flip to false once the elearning-service is live.
  static const bool useMockElearning = false;
  static const String appName = 'Kilimanjaro Schools';
  static const String minRequiredVersion = '1.0.0';

  /// The canonical production API. A release build must resolve to this (HTTPS)
  /// host; localhost and plain-HTTP endpoints are rejected at startup.
  static const String productionApiBaseUrl =
      'https://srms.kilimanjaroschools.site';

  /// True when compiled in release mode. Debug/profile builds keep the
  /// developer conveniences (localhost fallbacks); release builds do not.
  static bool get isRelease => kReleaseMode;

  static String get apiBaseUrl {
    final configured = _configuredBaseUrl;
    if (configured != null && configured.isNotEmpty) return configured;

    // No configuration provided. In release this is a hard error (surfaced by
    // [assertValidConfig] at startup); in debug we fall back to the emulator
    // host so day-to-day development needs no .env.
    if (isRelease) return productionApiBaseUrl;
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  static String? get _configuredBaseUrl {
    if (Platform.isAndroid) {
      return dotenv.maybeGet('API_BASE_URL_ANDROID') ??
          dotenv.maybeGet('API_BASE_URL');
    }
    return dotenv.maybeGet('API_BASE_URL');
  }

  /// Validates the resolved API configuration. Call once during startup,
  /// after dotenv has loaded. Throws [InvalidApiConfigException] on a release
  /// build with a missing, localhost, or non-HTTPS API URL so a misconfigured
  /// artifact fails loudly instead of silently pointing at the wrong host.
  static void assertValidConfig() {
    if (!isRelease) return;
    final error = validateReleaseApiUrl(_configuredBaseUrl);
    if (error != null) throw InvalidApiConfigException(error);
  }

  /// Pure validation for a release build's API URL. Returns an error message,
  /// or null when the URL is acceptable (HTTPS, non-localhost). Exposed so the
  /// rule is unit-testable without a release build.
  static String? validateReleaseApiUrl(String? url) {
    if (url == null || url.isEmpty) {
      return 'API_BASE_URL is not set for this release build.';
    }
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return 'API_BASE_URL is not a valid URL: $url';
    }
    if (uri.scheme != 'https') {
      return 'Release builds require an HTTPS API URL, got: $url';
    }
    const localHosts = {'localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0'};
    if (localHosts.contains(uri.host)) {
      return 'Release builds must not point at a local host, got: $url';
    }
    return null;
  }
}
