import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../games/application/games_providers.dart';
import '../../../games/domain/game.dart';
import '../../../games/domain/product.dart';
import '../../domain/saved_game.dart';

/// "My Games" card: shows the saved Player ID and a one-tap Quick Buy for
/// that game's cheapest active product. [onQuickBuy] receives the resolved
/// product so the caller can jump straight to checkout — no product
/// selection, no player-info form, matching the returning-user fast path.
class SavedGameCard extends ConsumerWidget {
  const SavedGameCard({
    super.key,
    required this.savedGame,
    required this.onQuickBuy,
  });

  final SavedGame savedGame;
  final void Function(Product product) onQuickBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    // Reuses the server saved from the last order on this game (if any) so
    // Quick Buy prices correctly for games where price depends on server.
    final productsAsync = ref.watch(
      gameProductsProvider((
        gameId: savedGame.game.id,
        serverCode: savedGame.serverId,
      )),
    );

    final isDark = theme.brightness == Brightness.dark;

    return Container(
      width: 220,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(
            alpha: isDark ? 0.4 : 0.7,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _GameIcon(game: savedGame.game),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  savedGame.game.name,
                  style: theme.textTheme.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            savedGame.serverId == null
                ? 'ID: ${savedGame.playerId}'
                : 'ID: ${savedGame.playerId} · ${savedGame.serverId}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          productsAsync.when(
            loading: () => const SizedBox(
              height: 36,
              child: Center(
                child: SizedBox(
                  height: 16,
                  width: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            error: (_, _) => const SizedBox.shrink(),
            data: (products) {
              if (products.isEmpty) return const SizedBox.shrink();
              final cheapest = products.reduce(
                (a, b) => a.amountMinor <= b.amountMinor ? a : b,
              );
              return SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => onQuickBuy(cheapest),
                  child: Text(
                    '${l10n.homeQuickBuyButton} · ${formatMoney(cheapest.amountMinor, cheapest.currency, localeName)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

/// The same real-logo-with-gradient-fallback treatment [GameCard] uses in
/// the catalog grid, scaled down for this compact row — a plain text emoji
/// here read as noticeably less finished than every other place a game's
/// icon appears in the app.
class _GameIcon extends StatelessWidget {
  const _GameIcon({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final logoUrl = game.logoUrl;
    final gradient =
        AppColors.tileGradients[game.name.hashCode.abs() %
            AppColors.tileGradients.length];

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: SizedBox(
        width: 28,
        height: 28,
        child: logoUrl == null || logoUrl.isEmpty
            ? _fallback(gradient, game.logoEmoji)
            : CachedNetworkImage(
                imageUrl: logoUrl,
                fit: BoxFit.cover,
                placeholder: (context, _) => _fallback(gradient, null),
                errorWidget: (context, _, _) =>
                    _fallback(gradient, game.logoEmoji),
              ),
      ),
    );
  }

  Widget _fallback(List<Color> gradient, String? emoji) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
      ),
      alignment: Alignment.center,
      child: emoji != null
          ? Text(emoji, style: const TextStyle(fontSize: 14))
          : null,
    );
  }
}
