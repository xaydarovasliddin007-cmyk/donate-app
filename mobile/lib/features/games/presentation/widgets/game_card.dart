import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/game.dart';

/// Icon-tile layout — a square cover (matching the source data, which is
/// always a square Play Store icon) sitting in a bordered, lightly-elevated
/// card with the title below, rather than force-cropping a square image
/// into a tall "key art" card (which was cutting off a large chunk of every
/// icon and reading as a rendering bug, not a design choice).
class GameCard extends StatelessWidget {
  const GameCard({super.key, required this.game, required this.onTap});

  final Game game;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final comingSoon = !game.isPurchasable;
    final gradient =
        AppColors.tileGradients[game.name.hashCode.abs() %
            AppColors.tileGradients.length];

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
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _CoverArt(game: game, gradient: gradient),
                    if (comingSoon)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            AppLocalizations.of(context).gameComingSoonBadge,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: Colors.white,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs + 2),
            Text(
              game.name,
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (game.category != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  game.category!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CoverArt extends StatelessWidget {
  const _CoverArt({required this.game, required this.gradient});

  final Game game;
  final List<Color> gradient;

  @override
  Widget build(BuildContext context) {
    final logoUrl = game.logoUrl;
    if (logoUrl == null || logoUrl.isEmpty) {
      return _FallbackTile(game: game, gradient: gradient);
    }
    return CachedNetworkImage(
      imageUrl: logoUrl,
      fit: BoxFit.cover,
      placeholder: (context, _) =>
          _FallbackTile(game: game, gradient: gradient, showEmoji: false),
      errorWidget: (context, _, _) =>
          _FallbackTile(game: game, gradient: gradient),
    );
  }
}

class _FallbackTile extends StatelessWidget {
  const _FallbackTile({
    required this.game,
    required this.gradient,
    this.showEmoji = true,
  });

  final Game game;
  final List<Color> gradient;
  final bool showEmoji;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
      ),
      alignment: Alignment.center,
      child: showEmoji
          ? Text(game.logoEmoji ?? '🎮', style: const TextStyle(fontSize: 32))
          : null,
    );
  }
}
