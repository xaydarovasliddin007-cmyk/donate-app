import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/errors/failure.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../../games/application/games_providers.dart';
import '../../games/domain/game.dart';
import '../../games/presentation/widgets/game_card.dart';
import '../../games/presentation/widgets/product_card.dart';
import '../../notifications/application/notifications_providers.dart';
import '../../orders/application/orders_providers.dart';
import '../../orders/presentation/widgets/order_card.dart';
import '../../saved_games/application/saved_games_providers.dart';
import '../../saved_games/presentation/widgets/saved_game_card.dart';
import '../../wallet/presentation/widgets/wallet_balance_card.dart';
import '../application/promotions_provider.dart';
import 'widgets/promotion_banner.dart';
import 'widgets/section_header.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

/// Number of games shown in the home screen's curated preview grid before
/// the rest live behind the dedicated "Games" tab's full searchable catalog.
const _popularGamesPreviewCount = 9;

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Game? _findGameBySlug(List<Game> games, String slug) {
    for (final game in games) {
      if (game.slug == slug) return game;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final gamesAsync = ref.watch(gamesListProvider);
    final promotionsAsync = ref.watch(promotionsListProvider);
    final user = ref.watch(authControllerProvider).value?.user;
    final isAuthenticated = user != null;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: user?.displayName == null
            ? const BrandMark(size: 28, showWordmark: true)
            : Row(
                children: [
                  UserAvatar(avatarUrl: user!.avatarUrl, radius: 16),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      '${l10n.homeGreeting}, ${user.displayName} 👋',
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
        actions: [
          if (isAuthenticated)
            Consumer(
              builder: (context, ref, _) {
                final unreadCount =
                    ref.watch(notificationsProvider).value?.unreadCount ?? 0;
                return IconButton(
                  icon: Badge(
                    isLabelVisible: unreadCount > 0,
                    label: Text('$unreadCount'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                  tooltip: l10n.notificationsTitle,
                  onPressed: () => context.push('/notifications'),
                );
              },
            ),
          const _LocaleToggleButton(),
          const _ThemeToggleButton(),
          const SizedBox(width: AppSpacing.sm),
        ],
      ),
      // Two soft brand-colored glows (top-left primary, lower-right accent)
      // instead of one small patch confined to the header — a single tight
      // glow still read as "mostly flat black with a sticker on it"; a pair
      // spanning most of the first screenful is what actually reads as a
      // considered dark theme instead of Material defaults with the
      // brightness turned down.
      body: Stack(
        children: [
          Positioned(
            top: -80,
            left: -60,
            right: 0,
            height: 520,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.6, -0.9),
                  radius: 1.1,
                  colors: [
                    (isDark
                            ? AppColors.brandPrimaryDark
                            : AppColors.brandPrimary)
                        .withValues(alpha: 0.30),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 260,
            right: -100,
            left: 60,
            height: 480,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.8, 0),
                  radius: 1.0,
                  colors: [
                    (isDark ? AppColors.brandAccentDark : AppColors.brandAccent)
                        .withValues(alpha: 0.18),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(gamesListProvider);
              ref.invalidate(promotionsListProvider);
              if (isAuthenticated) ref.invalidate(myOrdersProvider);
            },
            child: ListView(
              padding: const EdgeInsets.only(bottom: AppSpacing.xl),
              children: [
                if (isAuthenticated) ...[
                  const SizedBox(height: AppSpacing.md),
                  const WalletBalanceCard(),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Tap-through to the dedicated Games tab's real search — kept
                // here purely as a discoverability affordance/entry point, not a
                // second copy of the filter logic to keep in sync.
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    isAuthenticated ? 0 : AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: TextField(
                    readOnly: true,
                    // Literal path, not AppRoutes.games: app_router.dart imports
                    // this screen, so importing it back here for one constant
                    // would create a circular import.
                    onTap: () => context.go('/catalog'),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: l10n.homeSearchHint,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                  ),
                ),

                // Colorful one-tap shortcuts into the Games tab pre-filtered
                // by category — real navigation (not decoration): each tap
                // lands on the full catalog already filtered, same as
                // picking that chip there manually.
                SizedBox(
                  height: 84,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                    ),
                    children: [
                      for (final entry in _quickCategories)
                        Padding(
                          padding: const EdgeInsets.only(right: AppSpacing.md),
                          child: _QuickCategoryTile(
                            icon: entry.$1,
                            label: entry.$2,
                            onTap: () =>
                                context.go('/catalog', extra: entry.$2),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),

                promotionsAsync.when(
                  data: (promotions) => promotions.isEmpty
                      ? const SizedBox.shrink()
                      : SizedBox(
                          height: 116,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.lg,
                            ),
                            itemCount: promotions.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(width: AppSpacing.sm),
                            itemBuilder: (_, i) =>
                                PromotionBanner(promotion: promotions[i]),
                          ),
                        ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),

                gamesAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.only(top: AppSpacing.md),
                    child: GameGridSkeleton(),
                  ),
                  error: (error, _) {
                    final failure = Failure.from(error);
                    return Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: ErrorView(
                        title: failure.isNetworkError
                            ? l10n.errorNoConnectionTitle
                            : l10n.errorGenericTitle,
                        message: failure.isNetworkError
                            ? l10n.errorNoConnectionMessage
                            : l10n.errorGenericMessage,
                        retryLabel: l10n.commonRetry,
                        onRetry: () => ref.invalidate(gamesListProvider),
                      ),
                    );
                  },
                  data: (games) {
                    final mlbb = _findGameBySlug(games, 'mobile-legends');
                    final preview = games
                        .take(_popularGamesPreviewCount)
                        .toList();

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SectionHeader(
                          title: l10n.homePopularGames,
                          trailing: games.length > _popularGamesPreviewCount
                              ? TextButton(
                                  onPressed: () => context.go('/catalog'),
                                  child: Text(l10n.commonSeeAll),
                                )
                              : null,
                        ),
                        if (preview.isEmpty)
                          Padding(
                            padding: const EdgeInsets.all(AppSpacing.xl),
                            child: EmptyView(title: l10n.emptyGenericTitle),
                          )
                        else
                          GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.lg,
                            ),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  mainAxisSpacing: AppSpacing.sm,
                                  crossAxisSpacing: AppSpacing.sm,
                                  childAspectRatio: 0.58,
                                ),
                            itemCount: preview.length,
                            itemBuilder: (context, index) {
                              final game = preview[index];
                              return StaggeredEntrance(
                                index: index,
                                child: GameCard(
                                  game: game,
                                  onTap: () =>
                                      context.push('/games/${game.id}'),
                                ),
                              );
                            },
                          ),

                        if (mlbb != null)
                          Consumer(
                            builder: (context, ref, _) {
                              // No server context here — for games with a server
                              // catalog (like MLBB) this deliberately comes back
                              // empty, and the whole section just hides itself
                              // rather than showing prices for the wrong server;
                              // picking a server happens on the game's own page.
                              final productsAsync = ref.watch(
                                gameProductsProvider((
                                  gameId: mlbb.id,
                                  serverCode: null,
                                )),
                              );
                              return productsAsync.when(
                                loading: () => Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    SectionHeader(
                                      title: l10n.homePopularTopups,
                                    ),
                                    const Padding(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: AppSpacing.lg,
                                      ),
                                      child: Column(
                                        children: [
                                          Padding(
                                            padding: EdgeInsets.only(
                                              bottom: AppSpacing.sm,
                                            ),
                                            child: ListRowSkeleton(),
                                          ),
                                          ListRowSkeleton(),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                error: (_, _) => const SizedBox.shrink(),
                                data: (products) {
                                  if (products.isEmpty) {
                                    return const SizedBox.shrink();
                                  }
                                  return Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      SectionHeader(
                                        title: l10n.homePopularTopups,
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: AppSpacing.lg,
                                        ),
                                        child: Column(
                                          children: [
                                            for (final product in products.take(
                                              3,
                                            ))
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  bottom: AppSpacing.sm,
                                                ),
                                                child: ProductCard(
                                                  product: product,
                                                  onTap: () => context.push(
                                                    '/games/${mlbb.id}',
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              );
                            },
                          ),
                      ],
                    );
                  },
                ),

                if (isAuthenticated) ...[
                  Consumer(
                    builder: (context, ref, _) {
                      final savedGamesAsync = ref.watch(savedGamesListProvider);
                      return savedGamesAsync.when(
                        loading: () => const SizedBox.shrink(),
                        error: (_, _) => const SizedBox.shrink(),
                        data: (savedGames) {
                          if (savedGames.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SectionHeader(title: l10n.homeMyGames),
                              SizedBox(
                                height: 152,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.lg,
                                  ),
                                  itemCount: savedGames.length,
                                  separatorBuilder: (_, _) =>
                                      const SizedBox(width: AppSpacing.sm),
                                  itemBuilder: (_, i) => SavedGameCard(
                                    savedGame: savedGames[i],
                                    onQuickBuy: (product) => context.push(
                                      '/checkout/confirm',
                                      extra: {
                                        'game': savedGames[i].game,
                                        'product': product,
                                        'playerId': savedGames[i].playerId,
                                        'serverId':
                                            savedGames[i].serverId ?? '',
                                      },
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      );
                    },
                  ),
                ],

                if (isAuthenticated) ...[
                  SectionHeader(title: l10n.homeRecentOrders),
                  Consumer(
                    builder: (context, ref, _) {
                      final ordersAsync = ref.watch(myOrdersProvider);
                      return ordersAsync.when(
                        loading: () => const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                          child: Column(
                            children: [
                              Padding(
                                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                                child: ListRowSkeleton(),
                              ),
                              ListRowSkeleton(),
                            ],
                          ),
                        ),
                        error: (_, _) => const SizedBox.shrink(),
                        data: (orders) {
                          if (orders.isEmpty) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.lg,
                            ),
                            child: Column(
                              children: [
                                for (final order in orders.take(3))
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      bottom: AppSpacing.sm,
                                    ),
                                    child: OrderCard(
                                      order: order,
                                      onTap: () =>
                                          context.push('/orders/${order.id}'),
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact language pill in the app bar — real functionality (persists via
/// the same [localeControllerProvider] the Profile screen's segmented
/// button uses), just surfaced somewhere more discoverable too. Only two
/// languages ship today, so a tap simply toggles between them.
class _LocaleToggleButton extends ConsumerWidget {
  const _LocaleToggleButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final locale = ref.watch(localeControllerProvider);
    final other = locale.languageCode == 'uz'
        ? const Locale('ru')
        : const Locale('uz');

    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Material(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          onTap: () =>
              ref.read(localeControllerProvider.notifier).setLocale(other),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(
              locale.languageCode.toUpperCase(),
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Cycles light -> dark -> system on tap, icon reflecting the resulting
/// mode — same [themeModeControllerProvider] the Profile screen's
/// segmented control uses.
class _ThemeToggleButton extends ConsumerWidget {
  const _ThemeToggleButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeControllerProvider);
    final icon = switch (mode) {
      ThemeMode.light => Icons.light_mode_outlined,
      ThemeMode.dark => Icons.dark_mode_outlined,
      ThemeMode.system => Icons.brightness_auto_outlined,
    };
    final next = switch (mode) {
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.system,
      ThemeMode.system => ThemeMode.light,
    };

    return IconButton(
      icon: Icon(icon),
      onPressed: () =>
          ref.read(themeModeControllerProvider.notifier).setThemeMode(next),
    );
  }
}

/// (icon, category label) — the label must exactly match a real
/// `Game.category` value from the catalog, since tapping navigates to the
/// Games tab pre-filtered by it; this is real navigation, not decoration.
/// Deliberately one shared brand tint for every tile, not a different hue
/// each — a row of six unrelated colors read as noisy, not lively.
const _quickCategories = <(IconData, String)>[
  (Icons.sports_esports_rounded, 'MOBA'),
  (Icons.gps_fixed_rounded, 'Battle Royale'),
  (Icons.radar_rounded, 'FPS'),
  (Icons.auto_awesome_rounded, 'RPG'),
  (Icons.castle_rounded, 'Strategy'),
  (Icons.sports_soccer_rounded, 'Sports'),
];

class _QuickCategoryTile extends StatelessWidget {
  const _QuickCategoryTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 68,
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.6,
                ),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: theme.colorScheme.outlineVariant.withValues(
                    alpha: 0.5,
                  ),
                ),
              ),
              child: ShaderMask(
                shaderCallback: (bounds) => LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradient,
                ).createShader(bounds),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
