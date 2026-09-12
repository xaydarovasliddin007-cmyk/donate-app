import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:donate_app/core/theme/reduce_motion_controller.dart';
import 'package:donate_app/core/theme/theme_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('ThemeModeController', () {
    test('defaults to ThemeMode.system when no saved preference exists', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      expect(container.read(themeModeControllerProvider), ThemeMode.system);
    });

    test('setting theme mode updates state and persists choice to PreferencesService', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      await container
          .read(themeModeControllerProvider.notifier)
          .setThemeMode(ThemeMode.dark);

      expect(container.read(themeModeControllerProvider), ThemeMode.dark);
      expect(prefs.themeMode, 'dark');

      await container
          .read(themeModeControllerProvider.notifier)
          .setThemeMode(ThemeMode.light);

      expect(container.read(themeModeControllerProvider), ThemeMode.light);
      expect(prefs.themeMode, 'light');
    });

    test('loads saved theme preference from storage on startup', () async {
      SharedPreferences.setMockInitialValues({'settings.theme_mode': 'dark'});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      expect(container.read(themeModeControllerProvider), ThemeMode.dark);
    });
  });

  group('ReduceMotionController', () {
    test('defaults to false when not configured', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      expect(container.read(reduceMotionProvider), isFalse);
    });

    test('updates state and persists to storage', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      await container
          .read(reduceMotionProvider.notifier)
          .setReduceMotion(true);

      expect(container.read(reduceMotionProvider), isTrue);
      expect(prefs.reduceMotion, isTrue);

      await container
          .read(reduceMotionProvider.notifier)
          .setReduceMotion(false);

      expect(container.read(reduceMotionProvider), isFalse);
      expect(prefs.reduceMotion, isFalse);
    });
  });
}
