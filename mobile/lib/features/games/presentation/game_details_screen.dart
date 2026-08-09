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
import '../application/games_providers.dart';
import '../domain/game.dart';
import '../domain/product.dart';
import 'widgets/product_card.dart';

class GameDetailsScreen extends ConsumerWidget {
  const GameDetailsScreen({super.key, required this.gameId});

  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final gameAsync = ref.watch(gameByIdProvider(gameId));

    return Scaffold(
      appBar: AppBar(title: Text(gameAsync.value?.name ?? l10n.gameDetailsTopupTitle)),
      body: gameAsync.when(
        loading: () => const LoadingView(),
        error: (error, _) {
          final failure = Failure.from(error);
          return ErrorView(
            title: failure.isNetworkError ? l10n.errorNoConnectionTitle : l10n.errorGenericTitle,
            message: failure.isNetworkError ? l10n.errorNoConnectionMessage : l10n.errorGenericMessage,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(gameByIdProvider(gameId)),
          );
        },
        data: (game) {
          if (!game.isPurchasable) {
            return EmptyView(
              icon: Icons.hourglass_top_rounded,
              title: l10n.commonComingSoon,
              message: l10n.gameNotAvailableMessage,
            );
          }
          return _ProductsList(game: game);
        },
      ),
    );
  }
}

class _ProductsList extends ConsumerWidget {
  const _ProductsList({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final productsAsync = ref.watch(gameProductsProvider(game.id));

    return productsAsync.when(
      loading: () => const LoadingView(),
      error: (error, _) {
        final failure = Failure.from(error);
        return ErrorView(
          title: failure.isNetworkError ? l10n.errorNoConnectionTitle : l10n.errorGenericTitle,
          message: failure.isNetworkError ? l10n.errorNoConnectionMessage : l10n.errorGenericMessage,
          retryLabel: l10n.commonRetry,
          onRetry: () => ref.invalidate(gameProductsProvider(game.id)),
        );
      },
      data: (products) {
        if (products.isEmpty) {
          return EmptyView(title: l10n.gameProductsEmptyTitle);
        }
        return ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text(l10n.gameDetailsTopupTitle, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            for (final product in products)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: ProductCard(
                  product: product,
                  onTap: () => _onProductTap(context, ref, product),
                ),
              ),
          ],
        );
      },
    );
  }

  Future<void> _onProductTap(BuildContext context, WidgetRef ref, Product product) async {
    final isAuthenticated = ref.read(authControllerProvider).value?.isAuthenticated ?? false;
    if (!isAuthenticated) {
      await context.push('/login');
      final stillGuest = !(ref.read(authControllerProvider).value?.isAuthenticated ?? false);
      if (stillGuest || !context.mounted) return;
    }
    if (context.mounted) {
      context.push('/checkout/player-info', extra: {'game': game, 'product': product});
    }
  }
}
