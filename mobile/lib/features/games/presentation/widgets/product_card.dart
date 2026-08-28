import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../domain/product.dart';

/// Denomination tiers aren't all the same *kind* of thing — a plain
/// currency pack, a first-top-up-bonus pack (sold at double value), and
/// the different flavors of time-limited pass are different offers a
/// buyer should be able to tell apart at a glance, matching how a real
/// storefront (BekPinBot, shared as a reference in chat) badges and
/// re-icons each one instead of listing every tier identically. The
/// backend has no dedicated "kind" field for this, so it's inferred from
/// the product name — good enough for the tiers this app actually seeds
/// (MLBB's "x2"/"Elite"/"Twilight"/"Pass" wording). Icons are bundled
/// Twemoji SVG artwork (assets/icons/*.svg, CC-BY 4.0) rather than the
/// reference's own game art (that's Moonton's, not ours to copy) or the
/// system emoji font (renders as a flat, low-detail glyph on some devices)
/// — vector artwork stays crisp and colorful at any size/density.
enum _TierKind { bonus, elitePass, weeklyPass, hotPass, plain }

_TierKind _kindOf(String name) {
  final lower = name.toLowerCase();
  if (lower.contains('x2')) return _TierKind.bonus;
  if (lower.contains('twilight')) return _TierKind.hotPass;
  if (lower.contains('elite')) return _TierKind.elitePass;
  if (lower.contains('pass')) return _TierKind.weeklyPass;
  return _TierKind.plain;
}

class _KindStyle {
  const _KindStyle({required this.gradient, required this.iconAsset, this.badge});

  final List<Color> gradient;
  final String iconAsset;
  final String? badge;
}

_KindStyle _styleOf(_TierKind kind, bool isDark) {
  switch (kind) {
    case _TierKind.bonus:
      return const _KindStyle(
        gradient: [AppColors.brandWarm, Color(0xFFFF6B6B)],
        iconAsset: 'assets/icons/moneybag.svg',
        badge: '×2',
      );
    case _TierKind.elitePass:
      return const _KindStyle(
        gradient: [Color(0xFF8E5CF6), Color(0xFFFF4FA3)],
        iconAsset: 'assets/icons/crown.svg',
        badge: 'EP',
      );
    case _TierKind.weeklyPass:
      return const _KindStyle(
        gradient: [Color(0xFF19A7CE), Color(0xFF146CFF)],
        iconAsset: 'assets/icons/ticket.svg',
        badge: 'HP',
      );
    case _TierKind.hotPass:
      return const _KindStyle(
        gradient: [Color(0xFFFFB02E), Color(0xFFE0453C)],
        iconAsset: 'assets/icons/fire.svg',
        badge: 'HIT',
      );
    case _TierKind.plain:
      return _KindStyle(
        gradient: isDark ? AppColors.heroGradientDark : AppColors.heroGradientLight,
        iconAsset: 'assets/icons/gem.svg',
      );
  }
}

/// The tile a user actually picks a diamond/currency package from — a
/// compact horizontal row rather than a tall padded card, so a catalog
/// with a dozen-plus denominations (real supplier ladders run much longer
/// than the old 5-tier placeholder) still fits several rows on screen at
/// once instead of forcing a long scroll through near-square tiles.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final localeName = Localizations.localeOf(context).toString();
    final kind = _kindOf(product.name);
    final style = _styleOf(kind, isDark);

    return PressableScale(
      onTap: onTap,
      child: Stack(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest.withValues(
                alpha: isDark ? 0.35 : 0.55,
              ),
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(
                color: kind == _TierKind.plain
                    ? theme.colorScheme.outlineVariant.withValues(
                        alpha: isDark ? 0.4 : 0.7,
                      )
                    : style.gradient.first.withValues(alpha: 0.5),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: style.gradient,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  padding: const EdgeInsets.all(5),
                  child: SvgPicture.asset(style.iconAsset),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        product.name,
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        formatMoney(product.amountMinor, product.currency, localeName),
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: style.gradient.first,
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (product.isTest) ...[
                  const SizedBox(width: 4),
                  _MiniBadge(
                    label: 'TEST',
                    color: theme.colorScheme.tertiary,
                    textColor: Colors.black,
                  ),
                ],
              ],
            ),
          ),
          if (style.badge != null)
            Positioned(
              top: 4,
              right: 4,
              child: _MiniBadge(
                label: style.badge!,
                color: style.gradient.first,
                textColor: Colors.white,
              ),
            ),
        ],
      ),
    );
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({
    required this.label,
    required this.color,
    required this.textColor,
  });

  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.5),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: textColor,
          fontSize: 9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
