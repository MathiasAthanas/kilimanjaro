import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/auth_user.dart';
import '../../models/notification_model.dart';
import '../../models/notification_preference_model.dart';
import '../services/interfaces/notification_service_interface.dart';
import '../services/mock/mock_notification_service.dart';
import 'auth_provider.dart';

final notificationServiceProvider = Provider<INotificationService>((ref) {
  return MockNotificationService();
});

final currentUserProvider = FutureProvider<AuthUser?>((ref) async {
  return ref.watch(authServiceProvider).getCurrentUser();
});

final notificationsStreamProvider = StreamProvider<List<NotificationModel>>((ref) async* {
  final user = await ref.watch(currentUserProvider.future);
  if (user == null) {
    yield const [];
    return;
  }
  yield* ref.watch(notificationServiceProvider).watchNotifications(user);
});

final notificationGroupsProvider = Provider<List<NotificationGroup>>((ref) {
  final items = ref.watch(notificationsStreamProvider).value ?? const <NotificationModel>[];
  if (items.isEmpty) return const [];

  final now = DateTime.now();
  final nowDate = DateTime(now.year, now.month, now.day);
  final today = <NotificationModel>[];
  final yesterday = <NotificationModel>[];
  final thisWeek = <NotificationModel>[];
  final earlier = <NotificationModel>[];

  for (final item in items) {
    final itemDate = DateTime(item.createdAt.year, item.createdAt.month, item.createdAt.day);
    final diff = nowDate.difference(itemDate).inDays;
    if (diff == 0) {
      today.add(item);
    } else if (diff == 1) {
      yesterday.add(item);
    } else if (diff <= 7) {
      thisWeek.add(item);
    } else {
      earlier.add(item);
    }
  }

  final groups = <NotificationGroup>[];
  if (today.isNotEmpty) groups.add(NotificationGroup(label: 'Today', items: today));
  if (yesterday.isNotEmpty) {
    groups.add(NotificationGroup(label: 'Yesterday', items: yesterday));
  }
  if (thisWeek.isNotEmpty) groups.add(NotificationGroup(label: 'This Week', items: thisWeek));
  if (earlier.isNotEmpty) groups.add(NotificationGroup(label: 'Earlier', items: earlier));
  return groups;
});

final unreadCountProvider = Provider<int>((ref) {
  final items = ref.watch(notificationsStreamProvider).value ?? const <NotificationModel>[];
  return items.where((item) => !item.isRead).length;
});

final preferencesProvider =
    FutureProvider<List<NotificationPreferenceModel>>((ref) async {
  final user = await ref.watch(currentUserProvider.future);
  if (user == null) return const [];
  return ref.watch(notificationServiceProvider).getPreferences(user);
});

class NotificationPreferencesController
    extends AutoDisposeNotifier<Map<String, NotificationPreferenceModel>> {
  Timer? _saveTimer;

  @override
  Map<String, NotificationPreferenceModel> build() {
    ref.listen<AsyncValue<List<NotificationPreferenceModel>>>(
      preferencesProvider,
      (previous, next) {
        final items = next.value;
        if (items != null && state.isEmpty) {
          state = {for (final item in items) item.key: item};
        }
      },
    );
    ref.onDispose(() => _saveTimer?.cancel());
    return {};
  }

  void toggleChannel(String key, NotificationChannel channel, bool value) {
    final current = state[key];
    if (current == null) return;
    state = {
      ...state,
      key: current.copyWith(
        channels: {
          ...current.channels,
          channel: value,
        },
      ),
    };

    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 800), () async {
      final user = await ref.read(currentUserProvider.future);
      final updated = state[key];
      if (user == null || updated == null) return;
      await ref.read(notificationServiceProvider).updatePreference(user, key, updated);
    });
  }
}

final notificationPreferencesControllerProvider = NotifierProvider.autoDispose<
    NotificationPreferencesController, Map<String, NotificationPreferenceModel>>(
  NotificationPreferencesController.new,
);
