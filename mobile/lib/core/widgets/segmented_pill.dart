import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_motion.dart';
import '../theme/app_spacing.dart';

/// A branded, pill-shaped segmented control with a sliding gradient
/// indicator — the same visual language as [AppBottomNav], used wherever a
/// screen needs to pick one of a few options (language, theme) instead of
/// the stock [SegmentedButton], which reads as generic Material rather than
/// a considered part of this app.
class SegmentedPill<T> extends StatelessWidget {
  const SegmentedPill({
    super.key,
    required this.segments,
    required this.selected,
    required this.onChanged,
  });

  final List<(T value, String label)> segments;
  final T selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;
    final index = segments.indexWhere((s) => s.$1 == selected);

    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: AppMotion.medium,
            curve: AppMotion.emphasized,
            alignment: Alignment(
              segments.length == 1
                  ? 0
                  : -1 +
                        (2 *
                            index.clamp(0, segments.length - 1) /
                            (segments.length - 1)),
              0,
            ),
            child: FractionallySizedBox(
              widthFactor: 1 / segments.length,
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: gradient),
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
            ),
          ),
          Row(
            children: [
              for (final (value, label) in segments)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onChanged(value),
                    child: Center(
                      child: AnimatedDefaultTextStyle(
                        duration: AppMotion.fast,
                        style: theme.textTheme.labelLarge!.copyWith(
                          color: value == selected
                              ? Colors.white
                              : theme.colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
