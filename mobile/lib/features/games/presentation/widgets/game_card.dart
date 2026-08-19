import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/game.dart';

/// Full-bleed cover-art tile — the game's icon fills the whole card with a
/// bottom gradient scrim carrying the title, rather than a small icon above
/// a text label. Falls back to a brand-gradient tile with the emoji
/// centered when there's no [Game.logoUrl] or it fails to load — never a
/// broken image.
class GameCard extends StatelessWidget {
  const GameCard({super.key, required this.game, required this.onTap});

  final Game game;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final comingSoon = !game.isPurchasable;
    final gradient = AppColors.tileGradients[game.name.hashCode.abs() % AppColors.tileGradients.length];

    return PressableScale(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: AspectRatio(
          aspectRatio: 0.78,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _CoverArt(game: game, gradient: gradient),
              // Bottom scrim so the title stays legible over any image.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0.55, 1.0],
                    colors: [Colors.transparent, Color(0xCC000000)],
                  ),
                ),
              ),
              Positioned(
                left: AppSpacing.sm,
                right: AppSpacing.sm,
                bottom: AppSpacing.sm,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      game.name,
                      style: theme.textTheme.titleSmall?.copyWith(color: Colors.white),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (game.category != null)
                      Text(
                        game.category!,
                        style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              if (comingSoon)
                Positioned(
                  top: AppSpacing.sm,
                  right: AppSpacing.sm,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      AppLocalizations.of(context).gameComingSoonBadge,
                      style: theme.textTheme.labelSmall?.copyWith(color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
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
      placeholder: (context, _) => _FallbackTile(game: game, gradient: gradient, showEmoji: false),
      errorWidget: (context, _, _) => _FallbackTile(game: game, gradient: gradient),
    );
  }
}

class _FallbackTile extends StatelessWidget {
  const _FallbackTile({required this.game, required this.gradient, this.showEmoji = true});

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
          ? Text(game.logoEmoji ?? '🎮', style: const TextStyle(fontSize: 34))
          : null,
    );
  }
}
