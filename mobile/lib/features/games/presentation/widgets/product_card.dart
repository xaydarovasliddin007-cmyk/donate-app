import 'package:flutter/material.dart';
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
/// (MLBB's "x2"/"Elite"/"Twilight"/"Pass" wording). Icons for the
/// diamond-shaped kinds (bonus/elite/pass/plain-gem) are cropped directly
/// from a real competitor's (Uzpin) own product screenshots, at the
/// user's explicit request after two rounds of stock icon sets (Twemoji,
/// then Fluent Emoji 3D) were rejected as not matching what a real MLBB
/// storefront looks like — see assets/icons/{moneybag,pass,diamondpile,
/// safe,truck}.png. Twilight Pass keeps a bundled Fluent Emoji 3D flame
/// (Microsoft/MIT-licensed) since the reference's own art there is a
/// Moonton character portrait, not ours to copy; non-gem currencies (UC,
/// Robux, Tokens, CP…) keep the neutral Fluent coin.
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

/// Diamond-pile vs. safe vs. truck isn't arbitrary — the reference scales
/// the icon's "container" with how much the tier is actually worth (a
/// handful of diamonds for a cheap pack, a safe overflowing for a mid
/// pack, a truck dumping a mountain of them for the single biggest pack),
/// and that visual cue is worth reproducing rather than using one static
/// gem icon for every price point.
String _gemIconFor(int amountMinor) {
  if (amountMinor >= 800_000_00) return 'assets/icons/truck.png';
  if (amountMinor >= 60_000_00) return 'assets/icons/safe.png';
  return 'assets/icons/diamondpile.png';
}

_KindStyle _styleOf(_TierKind kind, bool isDark, String name, int amountMinor) {
  switch (kind) {
    case _TierKind.bonus:
      return const _KindStyle(
        gradient: [AppColors.brandWarm, Color(0xFFFF6B6B)],
        iconAsset: 'assets/icons/diamondpile.png',
        badge: '×2',
      );
    case _TierKind.elitePass:
      return const _KindStyle(
        gradient: [Color(0xFF8E5CF6), Color(0xFFFF4FA3)],
        iconAsset: 'assets/icons/moneybag.png',
        badge: 'EP',
      );
    case _TierKind.weeklyPass:
      return const _KindStyle(
        gradient: [Color(0xFF19A7CE), Color(0xFF146CFF)],
        iconAsset: 'assets/icons/pass.png',
        badge: 'HP',
      );
    case _TierKind.hotPass:
      return const _KindStyle(
        gradient: [Color(0xFFFFB02E), Color(0xFFE0453C)],
        iconAsset: 'assets/icons/fire.png',
        badge: 'HIT',
      );
    case _TierKind.plain:
      // Every non-MLBB game lands here — its currency isn't necessarily
      // diamonds (PUBG's UC, Roblox's Robux, Genshin's Genesis Crystals,
      // Honor of Kings' Tokens, CODM's CP, 8 Ball Pool's Cash, Standoff
      // 2's Gold, EA FC's FC Points…), so a diamond icon on all of them
      // was misleading. The diamondpile/safe/truck art is specifically
      // MLBB-style faceted blue diamonds (cropped from an MLBB reference)
      // — only apply it to currencies actually called "Diamonds" (Free
      // Fire matches too, and looks like the same style of gem). Other
      // premium currencies that just sound gem-adjacent (Clash's "Gems",
      // Genshin's "Genesis Crystals") would look like a branding mismatch
      // wearing MLBB's specific diamond art, so they fall to the neutral
      // coin along with everything else instead.
      final isDiamondLike = name.toLowerCase().contains('diamond');
      return _KindStyle(
        gradient: isDark ? AppColors.heroGradientDark : AppColors.heroGradientLight,
        iconAsset: isDiamondLike ? _gemIconFor(amountMinor) : 'assets/icons/coin.png',
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
    final style = _styleOf(kind, isDark, product.name, product.amountMinor);

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
                  padding: const EdgeInsets.all(3),
                  child: Image.asset(style.iconAsset, fit: BoxFit.contain),
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
