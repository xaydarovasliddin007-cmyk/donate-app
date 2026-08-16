import '../../../core/network/api_client.dart';
import '../domain/app_notification.dart';

class NotificationsResult {
  const NotificationsResult({required this.notifications, required this.unreadCount});

  final List<AppNotification> notifications;
  final int unreadCount;
}

class NotificationsApi {
  NotificationsApi(this._client);

  final ApiClient _client;

  Future<NotificationsResult> list({int limit = 30}) async {
    final json = await _client.get('/notifications', query: {'limit': limit});
    final notifications = json['notifications'] as List<dynamic>;
    return NotificationsResult(
      notifications: notifications.map((n) => AppNotification.fromJson(n as Map<String, dynamic>)).toList(),
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }

  Future<void> markAsRead(String id) => _client.post('/notifications/$id/read');

  Future<void> markAllAsRead() => _client.post('/notifications/read-all');
}
