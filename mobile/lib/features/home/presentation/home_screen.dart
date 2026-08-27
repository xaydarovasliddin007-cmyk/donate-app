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
import '../../wallet/application/wallet_providers.dart';
import '../../wallet/presentation/widgets/wallet_balance_card.dart';
import '../application/promotions_provider.dart';
import 'widgets/promotion_banner.dart';
import 'widgets/section_header.dart';

const _popularGamesPreviewCount = 9;

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

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
                      '${l10n.homeGreeting}, ${user.displayName}',
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
        actions: [
          if (isAuthenticated) ...[
            const _BalanceChip(),
            const SizedBox(width: 4),
          ],
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
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(gamesListProvider);
          ref.invalidate(promotionsListProvider);
          if (isAuthenticated) ref.invalidate(myOrdersProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: [
            const SizedBox(height: AppSpacing.md),
            if (isAuthenticated) ...[
              const WalletBalanceCard(),
              const SizedBox(height: AppSpacing.md),
            ] else ...[
              _GuestHero(
                onBrowse: () => context.go('/catalog'),
                onCreateAccount: () => context.push('/register'),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            _SearchLauncher(
              hintText: l10n.homeSearchHint,
              onTap: () => context.go('/catalog'),
            ),
            const SizedBox(height: AppSpacing.md),
            SectionHeader(title: l10n.homeQuickCategoriesTitle),
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: _quickCategories.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) {
                  final entry = _quickCategories[index];
                  return _QuickCategoryPill(
                    icon: entry.$1,
                    label: entry.$2,
                    gradient: AppColors
                        .tileGradients[index % AppColors.tileGradients.length],
                    onTap: () => context.go('/catalog', extra: entry.$2),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            promotionsAsync.when(
              data: (promotions) => promotions.isEmpty
                  ? const SizedBox.shrink()
                  : SizedBox(
                      height: 132,
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
                final preview = games.take(_popularGamesPreviewCount).toList();

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
                              childAspectRatio: 0.64,
                            ),
                        itemCount: preview.length,
                        itemBuilder: (context, index) {
                          final game = preview[index];
                          return StaggeredEntrance(
                            index: index,
                            child: GameCard(
                              game: game,
                              onTap: () => context.push('/games/${game.id}'),
                            ),
                          );
                        },
                      ),
                    if (mlbb != null)
                      Consumer(
                        builder: (context, ref, _) {
                          final productsAsync = ref.watch(
                            gameProductsProvider((
                              gameId: mlbb.id,
                              serverCode: null,
                            )),
                          );
                          return productsAsync.when(
                            loading: () => Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                SectionHeader(title: l10n.homePopularTopups),
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
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  SectionHeader(title: l10n.homePopularTopups),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.lg,
                                    ),
                                    child: Column(
                                      children: [
                                        for (final product in products.take(3))
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
            if (isAuthenticated)
              Consumer(
                builder: (context, ref, _) {
                  final savedGamesAsync = ref.watch(savedGamesListProvider);
                  return savedGamesAsync.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (savedGames) {
                      if (savedGames.isEmpty) return const SizedBox.shrink();
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
                                    'serverId': savedGames[i].serverId ?? '',
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
            if (isAuthenticated) ...[
              SectionHeader(title: l10n.homeRecentOrders),
              Consumer(
                builder: (context, ref, _) {
                  final ordersAsync = ref.watch(myOrdersProvider);
                  return ordersAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg),
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
    );
  }
}

class _GuestHero extends StatelessWidget {
  const _GuestHero({required this.onBrowse, required this.onCreateAccount});

  final VoidCallback onBrowse;
  final VoidCallback onCreateAccount;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: gradient.first.withValues(alpha: isDark ? 0.38 : 0.28),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned(
              right: -12,
              top: -10,
              child: Icon(
                Icons.sports_esports_rounded,
                size: 132,
                color: Colors.white.withValues(alpha: 0.12),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandMark(size: 42),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  l10n.homeHeroTitle,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.homeHeroSubtitle,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    FilledButton.icon(
                      onPressed: onBrowse,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.brandPrimary,
                        minimumSize: const Size(0, 44),
                      ),
                      icon: const Icon(Icons.bolt_rounded, size: 18),
                      label: Text(l10n.homeHeroPrimaryCta),
                    ),
                    OutlinedButton.icon(
                      onPressed: onCreateAccount,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.58),
                        ),
                        minimumSize: const Size(0, 44),
                      ),
                      icon: const Icon(
                        Icons.person_add_alt_1_rounded,
                        size: 18,
                      ),
                      label: Text(l10n.homeHeroSecondaryCta),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchLauncher extends StatelessWidget {
  const _SearchLauncher({required this.hintText, required this.onTap});

  final String hintText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Material(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          onTap: onTap,
          child: Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.7),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(
                    alpha: theme.brightness == Brightness.dark ? 0.18 : 0.05,
                  ),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(Icons.search_rounded, color: theme.colorScheme.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    hintText,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 18,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

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
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

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

const _quickCategories = <(IconData, String)>[
  (Icons.sports_esports_rounded, 'MOBA'),
  (Icons.gps_fixed_rounded, 'Battle Royale'),
  (Icons.radar_rounded, 'FPS'),
  (Icons.auto_awesome_rounded, 'RPG'),
  (Icons.castle_rounded, 'Strategy'),
  (Icons.sports_soccer_rounded, 'Sports'),
];

/// A filled gradient pill (icon + label in one row) rather than a bordered
/// vertical card — denser and reads more like a quick-action chip than a
/// standalone tile, matching the reference apps' horizontal category strip.
class _QuickCategoryPill extends StatelessWidget {
  const _QuickCategoryPill({
    required this.icon,
    required this.label,
    required this.gradient,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final List<Color> gradient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: gradient,
            ),
            borderRadius: BorderRadius.circular(AppRadius.pill),
            boxShadow: [
              BoxShadow(
                color: gradient.first.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: Colors.white, size: 17),
              const SizedBox(width: 6),
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact "glance" readout of the wallet balance in the AppBar — visible
/// without scrolling to the big balance card, matching the reference apps'
/// profile-header coin pill. Tapping it opens the same top-up flow as the
/// balance card's own quick action.
class _BalanceChip extends ConsumerWidget {
  const _BalanceChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final walletAsync = ref.watch(walletProvider);

    return walletAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (wallet) => Material(
        color: theme.colorScheme.surfaceContainerHighest.withValues(
          alpha: 0.6,
        ),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          onTap: () => context.push('/wallet/topup'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.bolt_rounded,
                  size: 14,
                  color: AppColors.brandWarm,
                ),
                const SizedBox(width: 4),
                Text(
                  _compactAmount(wallet.balanceMinor),
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A short "125K"/"3.4M" readout for the AppBar chip, where a fully
/// formatted currency string ("125 000 UZS") wouldn't fit — the balance
/// card below still shows the exact amount.
String _compactAmount(int amountMinor) {
  final majorUnits = amountMinor / 100;
  if (majorUnits >= 1000000) {
    final millions = majorUnits / 1000000;
    return '${millions.toStringAsFixed(millions % 1 == 0 ? 0 : 1)}M';
  }
  if (majorUnits >= 1000) {
    return '${(majorUnits / 1000).round()}K';
  }
  return majorUnits.round().toString();
}
