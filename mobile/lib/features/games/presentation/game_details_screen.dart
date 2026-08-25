import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../application/games_providers.dart';
import '../domain/game.dart';
import '../domain/game_server.dart';
import '../domain/product.dart';
import 'widgets/product_card.dart';

class GameDetailsScreen extends ConsumerWidget {
  const GameDetailsScreen({super.key, required this.gameId});

  final String gameId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final gameAsync = ref.watch(gameByIdProvider(gameId));

    return gameAsync.when(
      loading: () => const Scaffold(body: LoadingView()),
      error: (error, _) {
        final failure = Failure.from(error);
        return Scaffold(
          appBar: AppBar(),
          body: ErrorView(
            title: failure.isNetworkError
                ? l10n.errorNoConnectionTitle
                : l10n.errorGenericTitle,
            message: failure.isNetworkError
                ? l10n.errorNoConnectionMessage
                : l10n.errorGenericMessage,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(gameByIdProvider(gameId)),
          ),
        );
      },
      data: (game) {
        if (!game.isPurchasable) {
          return Scaffold(
            appBar: AppBar(title: Text(game.name)),
            body: EmptyView(
              icon: Icons.hourglass_top_rounded,
              title: l10n.commonComingSoon,
              message: l10n.gameNotAvailableMessage,
            ),
          );
        }
        return _GameDetailsBody(game: game);
      },
    );
  }
}

/// A big cover-art hero header (collapsing on scroll) above the server
/// picker and product grid — the game's own page should feel at least as
/// premium as its card did in the catalog grid, not drop back to a plain
/// text app bar.
class _GameDetailsBody extends ConsumerStatefulWidget {
  const _GameDetailsBody({required this.game});

  final Game game;

  @override
  ConsumerState<_GameDetailsBody> createState() => _GameDetailsBodyState();
}

class _GameDetailsBodyState extends ConsumerState<_GameDetailsBody> {
  String? _selectedServerCode;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final serversAsync = ref.watch(gameServersProvider(widget.game.id));

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 200,
            surfaceTintColor: Colors.transparent,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsetsDirectional.only(
                start: 56,
                bottom: 14,
                end: 16,
              ),
              title: Text(
                widget.game.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                ),
              ),
              // A brand-gradient backdrop with the (square, Play Store-sized)
              // icon centered in its own card — rather than force-cropping
              // that square icon across a wide banner via BoxFit.cover,
              // which cut off most of every icon's artwork.
              background: Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors:
                            AppColors.tileGradients[widget.game.name.hashCode
                                    .abs() %
                                AppColors.tileGradients.length],
                      ),
                    ),
                  ),
                  Align(
                    alignment: const Alignment(0, -0.15),
                    child: Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.35),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        child: widget.game.logoUrl != null
                            ? CachedNetworkImage(
                                imageUrl: widget.game.logoUrl!,
                                fit: BoxFit.cover,
                              )
                            : ColoredBox(
                                color: Colors.white.withValues(alpha: 0.18),
                                child: Center(
                                  child: Text(
                                    widget.game.logoEmoji ?? '🎮',
                                    style: const TextStyle(fontSize: 36),
                                  ),
                                ),
                              ),
                      ),
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0.45, 1.0],
                        colors: [Colors.transparent, Color(0xE6000000)],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          serversAsync.when(
            loading: () => const SliverFillRemaining(child: LoadingView()),
            error: (error, _) {
              final failure = Failure.from(error);
              return SliverFillRemaining(
                child: ErrorView(
                  title: failure.isNetworkError
                      ? l10n.errorNoConnectionTitle
                      : l10n.errorGenericTitle,
                  message: failure.isNetworkError
                      ? l10n.errorNoConnectionMessage
                      : l10n.errorGenericMessage,
                  retryLabel: l10n.commonRetry,
                  onRetry: () =>
                      ref.invalidate(gameServersProvider(widget.game.id)),
                ),
              );
            },
            data: (servers) {
              // Default to the first server the first time servers load —
              // after that this field is the single source of truth.
              if (servers.isNotEmpty && _selectedServerCode == null) {
                _selectedServerCode = servers.first.code;
              }
              final selectedServer = servers.isEmpty
                  ? null
                  : servers.firstWhere(
                      (s) => s.code == _selectedServerCode,
                      orElse: () => servers.first,
                    );

              return SliverMainAxisGroup(
                slivers: [
                  if (servers.length > 1)
                    SliverToBoxAdapter(
                      child: _ServerPicker(
                        servers: servers,
                        selectedCode: selectedServer!.code,
                        onSelect: (code) =>
                            setState(() => _selectedServerCode = code),
                      ),
                    ),
                  _ProductGrid(game: widget.game, server: selectedServer),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ServerPicker extends StatelessWidget {
  const _ServerPicker({
    required this.servers,
    required this.selectedCode,
    required this.onSelect,
  });

  final List<GameServer> servers;
  final String selectedCode;
  final void Function(String code) onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.gameServerPickerLabel,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: servers.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                final server = servers[i];
                return ChoiceChip(
                  label: Text(server.name),
                  selected: server.code == selectedCode,
                  onSelected: (_) => onSelect(server.code),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductGrid extends ConsumerWidget {
  const _ProductGrid({required this.game, required this.server});

  final Game game;
  final GameServer? server;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final productsAsync = ref.watch(
      gameProductsProvider((gameId: game.id, serverCode: server?.code)),
    );

    return productsAsync.when(
      loading: () => const SliverFillRemaining(child: LoadingView()),
      error: (error, _) {
        final failure = Failure.from(error);
        return SliverFillRemaining(
          child: ErrorView(
            title: failure.isNetworkError
                ? l10n.errorNoConnectionTitle
                : l10n.errorGenericTitle,
            message: failure.isNetworkError
                ? l10n.errorNoConnectionMessage
                : l10n.errorGenericMessage,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(
              gameProductsProvider((gameId: game.id, serverCode: server?.code)),
            ),
          ),
        );
      },
      data: (products) {
        if (products.isEmpty) {
          return SliverFillRemaining(
            child: EmptyView(title: l10n.gameProductsEmptyTitle),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: AppSpacing.sm,
              crossAxisSpacing: AppSpacing.sm,
              childAspectRatio: 0.92,
            ),
            delegate: SliverChildBuilderDelegate((context, i) {
              final product = products[i];
              return StaggeredEntrance(
                index: i,
                child: ProductCard(
                  product: product,
                  onTap: () => _onProductTap(context, ref, product),
                ),
              );
            }, childCount: products.length),
          ),
        );
      },
    );
  }

  Future<void> _onProductTap(
    BuildContext context,
    WidgetRef ref,
    Product product,
  ) async {
    final isAuthenticated =
        ref.read(authControllerProvider).value?.isAuthenticated ?? false;
    if (!isAuthenticated) {
      await context.push('/login');
      final stillGuest =
          !(ref.read(authControllerProvider).value?.isAuthenticated ?? false);
      if (stillGuest || !context.mounted) return;
    }
    if (context.mounted) {
      context.push(
        '/checkout/player-info',
        extra: {
          'game': game,
          'product': product,
          'serverCode': server?.code,
          'serverName': server?.name,
        },
      );
    }
  }
}
