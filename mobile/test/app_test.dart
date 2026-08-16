import 'package:donate_app/core/localization/locale_controller.dart';
import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:donate_app/features/onboarding/presentation/onboarding_screen.dart';
import 'package:donate_app/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Exercises the onboarding screen in isolation: it only depends on
// SharedPreferences-backed providers (locale/theme), so it doesn't need the
// secure-storage/network plumbing that AuthController pulls in for the full
// app shell — that flow is better covered by integration testing on a
// running backend than by a widget test with mocked platform channels.
Widget _wrapWithApp(Widget child, PreferencesService prefs) {
  return ProviderScope(
    overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
    child: Consumer(
      builder: (context, ref, _) {
        final locale = ref.watch(localeControllerProvider);
        return MaterialApp(
          locale: locale,
          supportedLocales: const [Locale('uz'), Locale('ru')],
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: child,
        );
      },
    ),
  );
}

void main() {
  testWidgets('onboarding renders uz text by default (test harness locale is unsupported)', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesService(await SharedPreferences.getInstance());

    await tester.pumpWidget(_wrapWithApp(const OnboardingScreen(), prefs));
    await tester.pumpAndSettle();

    expect(find.text("UZDONATE-ga xush kelibsiz"), findsOneWidget);
  });

  testWidgets('onboarding never shows a language or theme picker', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesService(await SharedPreferences.getInstance());

    await tester.pumpWidget(_wrapWithApp(const OnboardingScreen(), prefs));
    await tester.pumpAndSettle();

    expect(find.byType(SegmentedButton<Locale>), findsNothing);
    expect(find.byType(SegmentedButton<ThemeMode>), findsNothing);
  });

  group('LocaleController', () {
    test('falls back to Uzbek when no preference is saved and the device locale is unsupported', () async {
      // The flutter_test harness's platform locale defaults to en_US, which
      // this app doesn't ship — LocaleController must fall back to Uzbek
      // rather than crash or pick an unsupported locale.
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());
      final container = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);

      expect(container.read(localeControllerProvider), const Locale('uz'));
    });

    test('an explicit setLocale choice is persisted and wins on the next app start regardless of device locale', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = PreferencesService(await SharedPreferences.getInstance());

      final container1 = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container1.dispose);

      await container1.read(localeControllerProvider.notifier).setLocale(const Locale('ru'));
      expect(prefs.locale, 'ru');

      // Simulate a fresh app start (new container, same persisted prefs) —
      // the saved choice must win even though the test harness's platform
      // locale is neither 'uz' nor 'ru'.
      final container2 = ProviderContainer(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
      );
      addTearDown(container2.dispose);

      expect(container2.read(localeControllerProvider), const Locale('ru'));
    });
  });
}
