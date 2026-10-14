import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../branding/brand_icon.dart';
import '../theme/app_motion.dart';
import '../theme/app_spacing.dart';
import '../theme/reduce_motion_controller.dart';

class AppNavItem {
  const AppNavItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.brandSymbol,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final BrandSymbol? brandSymbol;
}

/// A custom, floating pill-shaped bottom navigation bar with a sliding
/// gradient indicator and an animated icon/label state per tab —
/// deliberately not the stock [NavigationBar] look, per the product's
/// "must not feel like a generic Flutter template" requirement.
class AppBottomNav extends ConsumerWidget {
  const AppBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
  });

  final List<AppNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final reduceMotion =
        ref.watch(reduceMotionProvider) ||
        MediaQuery.disableAnimationsOf(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: SafeArea(
        top: false,
        child: Container(
          height:
              68 +
              (MediaQuery.textScalerOf(context).scale(11) - 11).clamp(0, 16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xF5121925) : const Color(0xF7FFFFFF),
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.12)
                  : scheme.outlineVariant.withValues(alpha: 0.7),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
              if (isDark)
                BoxShadow(
                  color: scheme.primary.withValues(alpha: 0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: Stack(
            children: [
              AnimatedAlign(
                duration: reduceMotion ? Duration.zero : AppMotion.medium,
                curve: AppMotion.emphasized,
                alignment: Alignment(
                  items.length == 1
                      ? 0
                      : -1 + (2 * currentIndex / (items.length - 1)),
                  0,
                ),
                child: FractionallySizedBox(
                  widthFactor: 1 / items.length,
                  heightFactor: 1,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 7,
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            scheme.primary.withValues(
                              alpha: isDark ? 0.22 : 0.15,
                            ),
                            scheme.secondary.withValues(
                              alpha: isDark ? 0.16 : 0.10,
                            ),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(
                          color: scheme.primary.withValues(
                            alpha: isDark ? 0.35 : 0.25,
                          ),
                          width: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: _NavItemButton(
                        item: items[i],
                        selected: i == currentIndex,
                        reduceMotion: reduceMotion,
                        onTap: () => onTap(i),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItemButton extends StatelessWidget {
  const _NavItemButton({
    required this.item,
    required this.selected,
    required this.onTap,
    required this.reduceMotion,
  });

  final AppNavItem item;
  final bool selected;
  final VoidCallback onTap;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = selected ? scheme.primary : scheme.onSurfaceVariant;

    return Semantics(
      selected: selected,
      button: true,
      label: item.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedScale(
              scale: selected ? 1.08 : 1.0,
              duration: reduceMotion ? Duration.zero : AppMotion.micro,
              curve: Curves.easeOut,
              child: item.brandSymbol != null
                  ? BrandIcon(
                      item.brandSymbol!,
                      color: color,
                      selected: selected,
                    )
                  : Icon(
                      selected ? item.selectedIcon : item.icon,
                      color: color,
                      size: 24,
                    ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: reduceMotion ? Duration.zero : AppMotion.micro,
              style: Theme.of(context).textTheme.labelSmall!.copyWith(
                color: color,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
