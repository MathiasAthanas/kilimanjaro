import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// A cached read payload plus the time it was stored and whether it is stale.
class CachedRead<T> {
  const CachedRead({
    required this.data,
    required this.updatedAt,
    required this.isStale,
  });

  final T data;
  final DateTime updatedAt;
  final bool isStale;
}

/// A small persistent cache for read-only content so screens can show the last
/// known data (with a visible "updated X ago" timestamp) instead of a blank
/// page on a weak or dropped connection.
///
/// Only safe to use for non-sensitive, read-only content. It never caches
/// writes and never participates in retrying mutations.
class ReadCache {
  ReadCache._();

  static const String _prefix = 'read_cache::';

  /// Stores [value] (any JSON-encodable structure) under [key] with the current
  /// timestamp.
  static Future<void> write(String key, Object? value) async {
    final prefs = await SharedPreferences.getInstance();
    final envelope = jsonEncode({
      'at': DateTime.now().toIso8601String(),
      'v': value,
    });
    await prefs.setString('$_prefix$key', envelope);
  }

  /// Reads the cached value for [key], decoding it with [fromJson]. Returns null
  /// when nothing is cached or the stored payload is unreadable. [ttl] only sets
  /// the [CachedRead.isStale] flag — the data is still returned so the UI can
  /// show it while a refresh runs.
  static Future<CachedRead<T>?> read<T>(
    String key,
    T Function(dynamic json) fromJson, {
    Duration ttl = const Duration(hours: 6),
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_prefix$key');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final updatedAt = DateTime.tryParse(decoded['at'] as String? ?? '');
      if (updatedAt == null) return null;
      return CachedRead<T>(
        data: fromJson(decoded['v']),
        updatedAt: updatedAt,
        isStale: DateTime.now().difference(updatedAt) >= ttl,
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> remove(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefix$key');
  }

  /// Clears all read-cache entries (e.g. on logout).
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys().where((k) => k.startsWith(_prefix)).toList();
    for (final k in keys) {
      await prefs.remove(k);
    }
  }

  /// A short "updated 5m ago" style label for a cache timestamp.
  static String freshnessLabel(DateTime updatedAt) {
    final diff = DateTime.now().difference(updatedAt);
    if (diff.inSeconds < 60) return 'Updated just now';
    if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes}m ago';
    if (diff.inHours < 24) return 'Updated ${diff.inHours}h ago';
    return 'Updated ${diff.inDays}d ago';
  }
}
