import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:donate_app/core/widgets/empty_view.dart';
import 'package:donate_app/core/widgets/error_view.dart';
import 'package:donate_app/features/games/domain/game.dart';
import 'package:donate_app/features/games/presentation/widgets/game_card.dart';
import 'package:donate_app/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget _wrap(Widget child, PreferencesService prefs) {
  return ProviderScope(
    overrides: [
      preferencesServiceProvider.overrideWithValue(prefs),
    ],
    child: MaterialApp(
      locale: const Locale('uz'),
      supportedLocales: const [Locale('uz'), Locale('ru')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  late PreferencesService prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = PreferencesService(await SharedPreferences.getInstance());
  });

  group('EmptyView', () {
    testWidgets('renders title and optional message', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const EmptyView(
            title: 'Hozircha bo‘sh',
            message: 'Hech qanday buyurtma topilmadi',
            icon: Icons.inbox_outlined,
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Hozircha bo‘sh'), findsOneWidget);
      expect(find.text('Hech qanday buyurtma topilmadi'), findsOneWidget);
      expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
    });
  });

  group('ErrorView', () {
    testWidgets('renders title, message and triggers onRetry callback', (tester) async {
      var retryClicked = false;

      await tester.pumpWidget(
        _wrap(
          ErrorView(
            title: 'Xatolik yuz berdi',
            message: 'Serverga ulanish imkoni bo‘lmadi',
            retryLabel: 'Qayta urinish',
            onRetry: () {
              retryClicked = true;
            },
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Xatolik yuz berdi'), findsOneWidget);
      expect(find.text('Serverga ulanish imkoni bo‘lmadi'), findsOneWidget);
      expect(find.text('Qayta urinish'), findsOneWidget);

      await tester.tap(find.text('Qayta urinish'));
      await tester.pumpAndSettle();

      expect(retryClicked, isTrue);
    });
  });

  group('GameCard', () {
    testWidgets('renders purchasable game card with name and category', (tester) async {
      var tapped = false;
      const game = Game(
        id: 'game-1',
        slug: 'pubg-mobile',
        name: 'PUBG Mobile',
        category: 'Battle Royale',
        availability: GameAvailability.active,
      );

      await tester.pumpWidget(
        _wrap(
          SizedBox(
            width: 160,
            height: 220,
            child: GameCard(
              game: game,
              onTap: () {
                tapped = true;
              },
            ),
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('PUBG Mobile'), findsOneWidget);
      expect(find.text('Battle Royale'), findsOneWidget);

      await tester.tap(find.text('PUBG Mobile'));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });

    testWidgets('shows coming soon badge for non-purchasable game', (tester) async {
      const game = Game(
        id: 'game-2',
        slug: 'valorant',
        name: 'Valorant',
        category: 'Shooter',
        availability: GameAvailability.comingSoon,
      );

      await tester.pumpWidget(
        _wrap(
          SizedBox(
            width: 160,
            height: 220,
            child: GameCard(
              game: game,
              onTap: () {},
            ),
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Valorant'), findsOneWidget);
      expect(find.text('Tez kunda'), findsOneWidget);
    });
  });
}
