import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

/// Reflects and drives the *real* OS notification permission — the
/// Settings toggle this backs actually requests the permission (or, once
/// permanently denied, deep-links to the system app-settings page, since
/// Android won't let an app re-prompt at that point).
class NotificationPermissionController extends AsyncNotifier<bool> {
  @override
  Future<bool> build() async {
    return (await Permission.notification.status).isGranted;
  }

  /// Android has no API for an app to revoke its own notification
  /// permission — only the system Settings page can do that. So turning
  /// the switch off, and requesting again after a permanent denial, both
  /// route to the same place; only a fresh "on" tap actually requests.
  Future<void> setEnabled(bool wantEnabled) async {
    final status = await Permission.notification.status;
    if (wantEnabled && !status.isPermanentlyDenied) {
      await Permission.notification.request();
    } else {
      await openAppSettings();
    }
    state = AsyncData((await Permission.notification.status).isGranted);
  }
}

final notificationPermissionProvider =
    AsyncNotifierProvider<NotificationPermissionController, bool>(
      NotificationPermissionController.new,
    );
