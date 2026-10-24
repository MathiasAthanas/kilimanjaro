import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/announcement_model.dart';
import '../network/api_client.dart';
import 'auth_provider.dart';

class HodTimetableSlot {
  const HodTimetableSlot({
    required this.day,
    required this.time,
    required this.title,
    required this.subtitle,
  });

  final String day;
  final String time;
  final String title;
  final String subtitle;

  factory HodTimetableSlot.fromJson(Map<String, dynamic> json) => HodTimetableSlot(
        day: json['day'] as String? ?? '',
        time: json['time'] as String? ?? '',
        title: json['title'] as String? ?? '',
        subtitle: json['subtitle'] as String? ?? '',
      );
}

Future<List<Map<String, dynamic>>> _hodList(Ref ref, String path) async {
  final storage = ref.watch(secureStorageProvider);
  final dio = buildApiClient(storage, pathPrefix: '/api/v1');
  final token = await storage.read(key: 'access_token');
  final resp = await dio.get<dynamic>(
    path,
    options: Options(headers: token != null ? {'Authorization': 'Bearer $token'} : {}),
  );
  final data = resp.data;
  final raw = data is List ? data : (data is Map ? data['items'] : null);
  return (raw is List ? raw : const []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
}

final hodAnnouncementsProvider = FutureProvider<List<AnnouncementModel>>((ref) async {
  final rows = await _hodList(ref, '/hod/announcements');
  return rows.map(AnnouncementModel.fromJson).toList();
});

final hodTimetableProvider = FutureProvider<List<HodTimetableSlot>>((ref) async {
  final rows = await _hodList(ref, '/hod/timetable');
  return rows.map(HodTimetableSlot.fromJson).toList();
});
