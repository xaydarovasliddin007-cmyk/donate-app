import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../games/application/games_providers.dart';
import '../../../games/domain/product.dart';
import '../../domain/saved_game.dart';

/// "My Games" card: shows the saved Player ID and a one-tap Quick Buy for
/// that game's cheapest active product. [onQuickBuy] receives the resolved
/// product so the caller can jump straight to checkout — no product
/// selection, no player-info form, matching the returning-user fast path.
class SavedGameCard extends ConsumerWidget {
  const SavedGameCard({super.key, required this.savedGame, required this.onQuickBuy});

  final SavedGame savedGame;
  final void Function(Product product) onQuickBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final productsAsync = ref.watch(gameProductsProvider(savedGame.game.id));

    return Container(
      width: 220,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Text(savedGame.game.logoEmoji ?? '🎮', style: const TextStyle(fontSize: 20)),
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
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          productsAsync.when(
            loading: () => const SizedBox(
              height: 36,
              child: Center(child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))),
            ),
            error: (_, _) => const SizedBox.shrink(),
            data: (products) {
              if (products.isEmpty) return const SizedBox.shrink();
              final cheapest = products.reduce((a, b) => a.amountMinor <= b.amountMinor ? a : b);
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
