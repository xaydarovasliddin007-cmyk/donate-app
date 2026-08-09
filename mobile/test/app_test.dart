import 'package:donate_app/app.dart';
import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('renders the home screen in the default (uz) locale', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesService(await SharedPreferences.getInstance());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
        child: const DonateApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bosh sahifa'), findsOneWidget);
    expect(find.text("O'zbekcha"), findsWidgets);
  });

  testWidgets('switching to Russian updates on-screen text', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = PreferencesService(await SharedPreferences.getInstance());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
        child: const DonateApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Русский').first);
    await tester.pumpAndSettle();

    expect(find.text('Главная'), findsOneWidget);
  });
}
