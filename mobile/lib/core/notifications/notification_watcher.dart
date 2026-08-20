import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/notifications/application/notifications_providers.dart';
import '../../features/notifications/domain/app_notification.dart';
import '../storage/preferences_provider.dart';
import 'local_notifications_service.dart';

/// Polls for new notifications while the app is in the foreground and
/// posts each new one as a real local notification — this is what makes
/// the "reduce animations"-style Settings toggle for notifications
/// actually mean something, without needing Firebase/push.
class NotificationWatcher {
  NotificationWatcher(this._ref) {
    _timer = Timer.periodic(const Duration(seconds: 25), (_) => _tick());
    unawaited(_tick());
  }

  final Ref _ref;
  Timer? _timer;

  Future<void> _tick() async {
    final auth = _ref.read(authControllerProvider).value;
    if (auth?.isAuthenticated != true) return;
    if (!await Permission.notification.isGranted) return;

    try {
      final result = await _ref.read(notificationsApiProvider).list(limit: 10);
      final prefs = _ref.read(preferencesServiceProvider);
      final lastSeenId = prefs.lastSeenNotificationId;

      final unseen = <AppNotification>[];
      for (final notification in result.notifications) {
        if (notification.id == lastSeenId) break;
        unseen.add(notification);
      }
      if (result.notifications.isNotEmpty) {
        await prefs.setLastSeenNotificationId(result.notifications.first.id);
      }

      // First tick ever (no stored cursor yet): just record the cursor,
      // don't fire a burst of notifications for pre-existing history.
      if (lastSeenId == null) return;

      for (final notification in unseen.reversed) {
        await LocalNotificationsService.instance.show(
          id: notification.id.hashCode,
          title: notification.title,
          body: notification.body,
        );
      }
    } catch (_) {
      // Best-effort background poll — the in-app notification list is the
      // source of truth and has its own error handling; a transient
      // failure here should never surface to the user.
    }
  }

  void dispose() => _timer?.cancel();
}

/// Kept alive by being watched from [AppShell] — runs for as long as an
/// authenticated tab is on screen.
final notificationWatcherProvider = Provider<NotificationWatcher>((ref) {
  final watcher = NotificationWatcher(ref);
  ref.onDispose(watcher.dispose);
  return watcher;
});
