import 'package:flutter/widgets.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app.dart';
import 'core/notifications/local_notifications_service.dart';
import 'core/storage/preferences_provider.dart';
import 'core/storage/preferences_service.dart';

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();

  // Hold the native splash on screen until preferences are loaded and the
  // first frame is ready to paint in the correct theme — this is what
  // prevents the light/dark "flash" on cold start.
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  final sharedPreferences = await SharedPreferences.getInstance();
  final preferencesService = PreferencesService(sharedPreferences);
  await LocalNotificationsService.instance.init();

  runApp(
    ProviderScope(
      overrides: [
        preferencesServiceProvider.overrideWithValue(preferencesService),
      ],
      child: const _BootstrappedApp(),
    ),
  );
}

/// Removes the native splash on the first frame rendered with the real
/// (persisted) theme/locale already applied.
class _BootstrappedApp extends StatelessWidget {
  const _BootstrappedApp();

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => FlutterNativeSplash.remove(),
    );
    return const UzDonateApp();
  }
}
