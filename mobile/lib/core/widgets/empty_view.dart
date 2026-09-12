import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/app_spacing.dart';
import '../theme/reduce_motion_controller.dart';

/// Shown constantly across the app (empty orders, empty search, empty saved
/// games) — a fade/scale-in entrance so it reads as a considered state
/// rather than content abruptly popping into an otherwise-animated screen.
class EmptyView extends ConsumerWidget {
  const EmptyView({super.key, required this.title, this.message, this.icon});

  final String title;
  final String? message;
  final IconData? icon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: reduceMotion ? Duration.zero : AppMotion.entrance,
        curve: AppMotion.standard,
        builder: (context, t, child) => Opacity(
          opacity: t,
          child: Transform.scale(scale: 0.92 + (0.08 * t), child: child),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      theme.colorScheme.primary.withValues(alpha: 0.14),
                      theme.colorScheme.secondary.withValues(alpha: 0.08),
                    ],
                  ),
                  border: Border.all(
                    color: theme.colorScheme.primary.withValues(alpha: 0.22),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: theme.colorScheme.primary.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    icon ?? Icons.inbox_outlined,
                    size: 38,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                title,
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              if (message != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  message!,
                  style: theme.textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
