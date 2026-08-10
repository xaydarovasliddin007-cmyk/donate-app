import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../../games/application/games_providers.dart';
import '../../games/domain/game.dart';
import '../../games/presentation/widgets/game_card.dart';
import '../../games/presentation/widgets/product_card.dart';
import '../../orders/application/orders_providers.dart';
import '../../orders/presentation/widgets/order_status_badge.dart';
import '../../saved_games/application/saved_games_providers.dart';
import '../../saved_games/presentation/widgets/saved_game_card.dart';
import '../application/promotions_provider.dart';
import 'widgets/promotion_banner.dart';
import 'widgets/section_header.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  String? _selectedCategory;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

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
    final isAuthenticated = ref.watch(authControllerProvider).value?.isAuthenticated ?? false;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.homeTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(gamesListProvider);
          ref.invalidate(promotionsListProvider);
          if (isAuthenticated) ref.invalidate(myOrdersProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value.trim().toLowerCase()),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search_rounded),
                  hintText: l10n.homeSearchHint,
                ),
              ),
            ),

            promotionsAsync.when(
              data: (promotions) => promotions.isEmpty
                  ? const SizedBox.shrink()
                  : SizedBox(
                      height: 96,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                        itemCount: promotions.length,
                        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                        itemBuilder: (_, i) => PromotionBanner(promotion: promotions[i]),
                      ),
                    ),
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
            ),

            gamesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: LoadingView(),
              ),
              error: (error, _) {
                final failure = Failure.from(error);
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: ErrorView(
                    title: failure.isNetworkError ? l10n.errorNoConnectionTitle : l10n.errorGenericTitle,
                    message: failure.isNetworkError
                        ? l10n.errorNoConnectionMessage
                        : l10n.errorGenericMessage,
                    retryLabel: l10n.commonRetry,
                    onRetry: () => ref.invalidate(gamesListProvider),
                  ),
                );
              },
              data: (games) {
                final categories = <String>{
                  for (final g in games)
                    if (g.category != null) g.category!,
                }.toList()..sort();

                final filtered = games.where((g) {
                  final matchesQuery = _query.isEmpty || g.name.toLowerCase().contains(_query);
                  final matchesCategory = _selectedCategory == null || g.category == _selectedCategory;
                  return matchesQuery && matchesCategory;
                }).toList();

                final mlbb = _findGameBySlug(games, 'mobile-legends');

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (categories.isNotEmpty) ...[
                      SectionHeader(title: l10n.homeCategories),
                      SizedBox(
                        height: 40,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                          children: [
                            for (final category in categories)
                              Padding(
                                padding: const EdgeInsets.only(right: AppSpacing.sm),
                                child: ChoiceChip(
                                  label: Text(category),
                                  selected: _selectedCategory == category,
                                  onSelected: (selected) {
                                    setState(() => _selectedCategory = selected ? category : null);
                                  },
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],

                    SectionHeader(title: l10n.homePopularGames),
                    if (filtered.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        child: EmptyView(title: l10n.emptyGenericTitle),
                      )
                    else
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: AppSpacing.sm,
                          crossAxisSpacing: AppSpacing.sm,
                          childAspectRatio: 1.3,
                        ),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final game = filtered[index];
                          return GameCard(game: game, onTap: () => context.push('/games/${game.id}'));
                        },
                      ),

                    if (mlbb != null) ...[
                      SectionHeader(title: l10n.homePopularTopups),
                      Consumer(
                        builder: (context, ref, _) {
                          final productsAsync = ref.watch(gameProductsProvider(mlbb.id));
                          return productsAsync.when(
                            loading: () => const Padding(
                              padding: EdgeInsets.all(AppSpacing.lg),
                              child: LoadingView(),
                            ),
                            error: (_, _) => const SizedBox.shrink(),
                            data: (products) => Padding(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                              child: Column(
                                children: [
                                  for (final product in products.take(3))
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                      child: ProductCard(
                                        product: product,
                                        onTap: () => context.push('/games/${mlbb.id}'),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
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
                      if (savedGames.isEmpty) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SectionHeader(title: l10n.homeMyGames),
                          SizedBox(
                            height: 128,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                              itemCount: savedGames.length,
                              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
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
            ],

            if (isAuthenticated) ...[
              SectionHeader(title: l10n.homeRecentOrders),
              Consumer(
                builder: (context, ref, _) {
                  final ordersAsync = ref.watch(myOrdersProvider);
                  return ordersAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(AppSpacing.lg),
                      child: LoadingView(),
                    ),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (orders) {
                      if (orders.isEmpty) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                        child: Column(
                          children: [
                            for (final order in orders.take(3))
                              Card(
                                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                                child: ListTile(
                                  title: Text('${order.game.name} · ${order.items.first.productName}'),
                                  subtitle: Text(order.orderNumber),
                                  trailing: OrderStatusBadge(status: order.status),
                                  onTap: () => context.push('/orders/${order.id}'),
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
