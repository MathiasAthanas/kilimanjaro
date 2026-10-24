import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/auth_user.dart';
import '../network/api_client.dart';
import 'auth_provider.dart';
import 'notification_provider.dart';

class SchoolOption {
  const SchoolOption({required this.id, required this.name});
  final String id;
  final String name;
}

const _schoolsCacheKey = 'user_schools_json';

/// Schools the signed-in user can switch between. The gateway narrows the list
/// to the active school once one is selected, so the full list is fetched while
/// no school is selected (right after sign-in) and cached for the session.
final userSchoolsProvider = FutureProvider<List<SchoolOption>>((ref) async {
  final user = await ref.watch(currentUserProvider.future);
  if (user == null) return const [];
  // Students and parents belong to a single school.
  if (user.role == UserRole.student || user.role == UserRole.parent) return const [];

  final storage = ref.watch(secureStorageProvider);
  List<SchoolOption> parse(Object? raw) => (raw is List ? raw : const [])
      .whereType<Map>()
      .map((m) => SchoolOption(id: '${m['id']}', name: '${m['name']}'))
      .toList();

  final cached = await storage.read(key: _schoolsCacheKey);
  if (cached != null && cached.isNotEmpty) {
    try {
      return parse(jsonDecode(cached));
    } catch (_) {}
  }

  final dio = buildApiClient(storage, pathPrefix: '/api/v1');
  final token = await storage.read(key: 'access_token');
  final resp = await dio.get<dynamic>(
    '/mobile/schools',
    // The gateway narrows this list to the active school, so ask without it.
    options: Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
      extra: {'noActiveSchool': true},
    ),
  );
  final data = resp.data;
  final raw = data is Map ? data['schools'] : null;
  final schools = parse(raw);
  // Only cache the full list (a narrowed one would hide the other schools).
  final active = await storage.read(key: activeSchoolStorageKey);
  if (schools.length > 1 || active == null) {
    await storage.write(key: _schoolsCacheKey, value: jsonEncode(raw));
  }
  return schools;
});

/// Currently selected school id (null = let the server choose).
final activeSchoolIdProvider = FutureProvider<String?>((ref) async {
  ref.watch(sessionEpochProvider);
  final storage = ref.watch(secureStorageProvider);
  final stored = await storage.read(key: activeSchoolStorageKey);
  if (stored != null) return stored;
  // Multi-school staff start in their first school so the UI always names the
  // school the data belongs to (the server would otherwise pick one silently).
  // Group-level accounts (no explicit school memberships) default to "all schools".
  final user = await ref.watch(currentUserProvider.future);
  if (user == null || user.schoolIds.isEmpty) return null;
  final schools = await ref.watch(userSchoolsProvider.future);
  if (schools.length < 2) return null;
  await storage.write(key: activeSchoolStorageKey, value: schools.first.id);
  return schools.first.id;
});

/// Persists the choice, then refreshes every per-session provider so all
/// screens reload against the newly selected school.
Future<void> selectActiveSchool(WidgetRef ref, String? schoolId) async {
  final storage = ref.read(secureStorageProvider);
  if (schoolId == null) {
    await storage.delete(key: activeSchoolStorageKey);
  } else {
    await storage.write(key: activeSchoolStorageKey, value: schoolId);
  }
  ref.read(sessionEpochProvider.notifier).state++;
}
