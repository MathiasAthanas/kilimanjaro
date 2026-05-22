import '../../../models/auth_user.dart';
import '../../../models/notification_model.dart';
import '../../../models/notification_preference_model.dart';
import '../../../models/search_result_model.dart';

abstract interface class INotificationService {
  Future<List<NotificationModel>> getNotifications(AuthUser user);
  Stream<List<NotificationModel>> watchNotifications(AuthUser user);
  Future<NotificationModel?> getNotificationById(AuthUser user, String id);
  Future<void> markRead(AuthUser user, String id, {bool read = true});
  Future<void> markAllRead(AuthUser user);
  Future<void> deleteNotification(AuthUser user, String id);
  Future<List<NotificationPreferenceModel>> getPreferences(AuthUser user);
  Future<void> updatePreference(
    AuthUser user,
    String key,
    NotificationPreferenceModel value,
  );
  Future<List<SearchResultModel>> search(AuthUser user, String query);
  List<SearchResultModel> quickAccess(AuthUser user);
}
