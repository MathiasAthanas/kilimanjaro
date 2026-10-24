import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/core/config/app_config.dart';

void main() {
  group('AppConfig.validateReleaseApiUrl', () {
    test('accepts an HTTPS production host', () {
      expect(
        AppConfig.validateReleaseApiUrl('https://srms.kilimanjaroschools.site'),
        isNull,
      );
    });

    test('rejects a missing URL', () {
      expect(AppConfig.validateReleaseApiUrl(null), isNotNull);
      expect(AppConfig.validateReleaseApiUrl(''), isNotNull);
    });

    test('rejects plain HTTP', () {
      expect(
        AppConfig.validateReleaseApiUrl('http://srms.kilimanjaroschools.site'),
        contains('HTTPS'),
      );
    });

    test('rejects localhost and emulator hosts', () {
      expect(AppConfig.validateReleaseApiUrl('https://localhost:3000'),
          isNotNull);
      expect(AppConfig.validateReleaseApiUrl('http://10.0.2.2:3000'), isNotNull);
      expect(AppConfig.validateReleaseApiUrl('https://127.0.0.1'), isNotNull);
    });

    test('rejects a malformed URL', () {
      expect(AppConfig.validateReleaseApiUrl('not a url'), isNotNull);
    });
  });
}
