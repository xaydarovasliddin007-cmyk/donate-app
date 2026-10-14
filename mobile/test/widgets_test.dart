import 'package:donate_app/core/branding/brand_icon.dart';
import 'package:donate_app/core/storage/preferences_provider.dart';
import 'package:donate_app/core/storage/preferences_service.dart';
import 'package:donate_app/core/widgets/empty_view.dart';
import 'package:donate_app/core/widgets/error_view.dart';
import 'package:donate_app/core/widgets/app_bottom_nav.dart';
import 'package:donate_app/features/games/domain/game.dart';
import 'package:donate_app/features/games/presentation/widgets/game_card.dart';
import 'package:donate_app/features/wallet/application/wallet_providers.dart';
import 'package:donate_app/features/wallet/domain/wallet.dart';
import 'package:donate_app/features/wallet/presentation/widgets/wallet_balance_card.dart';
import 'package:donate_app/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget _wrap(Widget child, PreferencesService prefs) {
  return ProviderScope(
    overrides: [preferencesServiceProvider.overrideWithValue(prefs)],
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
    testWidgets('renders title, message and triggers onRetry callback', (
      tester,
    ) async {
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
    testWidgets('renders purchasable game card with name and category', (
      tester,
    ) async {
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

    testWidgets('shows coming soon badge for non-purchasable game', (
      tester,
    ) async {
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
            child: GameCard(game: game, onTap: () {}),
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Valorant'), findsOneWidget);
      expect(find.text('Tez kunda'), findsOneWidget);
    });
  });

  testWidgets(
    'wallet stays usable at 320px with large text and reduced motion',
    (tester) async {
      tester.view.physicalSize = const Size(320, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        _wrap(
          MediaQuery(
            data: const MediaQueryData(
              textScaler: TextScaler.linear(1.6),
              disableAnimations: true,
            ),
            child: ProviderScope(
              overrides: [
                walletProvider.overrideWith(
                  (ref) async =>
                      const Wallet(balanceMinor: 12345678900, currency: 'UZS'),
                ),
              ],
              child: const WalletBalanceCard(),
            ),
          ),
          prefs,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('UZDONATE'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pumpAndSettle();
      expect(find.text('••••••'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('brand navigation fits 320px and honors system reduced motion', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var selectedIndex = 0;

    await tester.pumpWidget(
      _wrap(
        MediaQuery(
          data: const MediaQueryData(
            textScaler: TextScaler.linear(1.6),
            disableAnimations: true,
          ),
          child: StatefulBuilder(
            builder: (context, setState) => AppBottomNav(
              currentIndex: selectedIndex,
              onTap: (index) => setState(() => selectedIndex = index),
              items: const [
                AppNavItem(
                  icon: Icons.home_outlined,
                  selectedIcon: Icons.home,
                  brandSymbol: BrandSymbol.home,
                  label: 'Главная',
                ),
                AppNavItem(
                  icon: Icons.gamepad_outlined,
                  selectedIcon: Icons.gamepad,
                  brandSymbol: BrandSymbol.catalog,
                  label: 'Магазин',
                ),
                AppNavItem(
                  icon: Icons.receipt_outlined,
                  selectedIcon: Icons.receipt,
                  brandSymbol: BrandSymbol.orders,
                  label: 'Заказы',
                ),
                AppNavItem(
                  icon: Icons.person_outline,
                  selectedIcon: Icons.person,
                  brandSymbol: BrandSymbol.profile,
                  label: 'Профиль',
                ),
              ],
            ),
          ),
        ),
        prefs,
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      tester.widget<AnimatedAlign>(find.byType(AnimatedAlign)).duration,
      Duration.zero,
    );
    await tester.tap(find.text('Магазин'));
    await tester.pumpAndSettle();
    expect(selectedIndex, 1);
    expect(tester.takeException(), isNull);
  });
}
