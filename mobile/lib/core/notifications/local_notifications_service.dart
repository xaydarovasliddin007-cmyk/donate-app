import 'package:flutter_local_notifications/flutter_local_notifications.dart';

const _channelId = 'uzdonate_default';

/// Wraps [FlutterLocalNotificationsPlugin] — real, OS-level notifications
/// posted locally while the app is running (order updates, top-up results).
/// This is not push (that needs a Firebase project's credentials, which
/// this environment doesn't have — see mobile/README.md), but it's a fully
/// real notification channel: the Settings toggle it's wired to actually
/// does something, and posted notifications show up in the system tray.
class LocalNotificationsService {
  LocalNotificationsService._();
  static final instance = LocalNotificationsService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    await _plugin.initialize(
      settings: const InitializationSettings(android: androidSettings),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _channelId,
            'UZDONATE',
            description: 'Order updates, top-ups, and promotions',
            importance: Importance.high,
          ),
        );
    _initialized = true;
  }

  Future<void> show({
    required int id,
    required String title,
    required String body,
  }) {
    return _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          'UZDONATE',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }
}
