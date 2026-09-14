import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../games/application/games_providers.dart';
import '../../domain/order.dart';
import 'order_status_badge.dart';

/// Shared order row for both the home screen's "Recent orders" preview and
/// the full order history list — a bordered, press-responsive tile matching
/// the rest of the app's card language (see [GameCard]) instead of a plain
/// Material [Card]/[ListTile], which read as flat next to everything else.
class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return PressableScale(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: theme.colorScheme.outlineVariant.withValues(
              alpha: isDark ? 0.4 : 0.7,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            _OrderGameIcon(
              gameName: order.game.name,
              gameSlug: order.game.slug,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${order.game.name} · ${order.items.first.productName}',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    order.orderNumber,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    order.serverId == null
                        ? '${l10n.orderPlayerIdLabel}: ${order.playerId}'
                        : '${l10n.orderPlayerIdLabel}: ${order.playerId} (${order.serverId})',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    DateFormat.yMd().add_Hm().format(
                      order.createdAt.toLocal(),
                    ),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                OrderStatusBadge(status: order.status),
                const SizedBox(height: 6),
                Text(
                  formatMoney(
                    order.amountMinor,
                    order.currency,
                    Localizations.localeOf(context).toString(),
                  ),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Game icon for the order row — looks up the game's official cover image
/// from [gamesListProvider] and renders it clipped with rounded corners,
/// falling back to a gradient monogram badge if the image isn't available.
class _OrderGameIcon extends ConsumerWidget {
  const _OrderGameIcon({required this.gameName, required this.gameSlug});

  final String gameName;
  final String gameSlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gamesList = ref.watch(gamesListProvider).asData?.value;
    final game = gamesList
        ?.where((g) => g.slug == gameSlug || g.name == gameName)
        .firstOrNull;
    final logoUrl = game?.logoUrl;

    if (logoUrl != null && logoUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: CachedNetworkImage(
          imageUrl: logoUrl,
          width: 40,
          height: 40,
          fit: BoxFit.cover,
          memCacheWidth: 120,
          memCacheHeight: 120,
          placeholder: (context, _) => _FallbackInitial(gameName: gameName),
          errorWidget: (context, _, _) => _FallbackInitial(gameName: gameName),
        ),
      );
    }

    return _FallbackInitial(gameName: gameName);
  }
}

class _FallbackInitial extends StatelessWidget {
  const _FallbackInitial({required this.gameName});

  final String gameName;

  @override
  Widget build(BuildContext context) {
    final gradient =
        AppColors.tileGradients[gameName.hashCode.abs() %
            AppColors.tileGradients.length];
    final initial = gameName.trim().isEmpty
        ? '?'
        : gameName.trim()[0].toUpperCase();

    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }
}
