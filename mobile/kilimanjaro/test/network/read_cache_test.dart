import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/core/network/read_cache.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('writes and reads back a fresh payload', () async {
    await ReadCache.write('terms', {'count': 3});
    final cached = await ReadCache.read<Map<String, dynamic>>(
      'terms',
      (json) => Map<String, dynamic>.from(json as Map),
    );
    expect(cached, isNotNull);
    expect(cached!.data['count'], 3);
    expect(cached.isStale, isFalse);
  });

  test('flags an entry older than the ttl as stale', () async {
    await ReadCache.write('terms', {'count': 1});
    final cached = await ReadCache.read<Map<String, dynamic>>(
      'terms',
      (json) => Map<String, dynamic>.from(json as Map),
      ttl: Duration.zero,
    );
    expect(cached, isNotNull);
    expect(cached!.isStale, isTrue);
  });

  test('returns null for a missing key', () async {
    final cached = await ReadCache.read<Object>('nope', (json) => json as Object);
    expect(cached, isNull);
  });

  test('clear removes cached entries', () async {
    await ReadCache.write('a', 1);
    await ReadCache.clear();
    final cached = await ReadCache.read<Object>('a', (json) => json as Object);
    expect(cached, isNull);
  });

  test('freshnessLabel formats recent timestamps', () {
    expect(ReadCache.freshnessLabel(DateTime.now()), 'Updated just now');
    expect(
      ReadCache.freshnessLabel(
          DateTime.now().subtract(const Duration(minutes: 5))),
      'Updated 5m ago',
    );
  });
}
