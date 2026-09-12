import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/app_spacing.dart';
import '../theme/reduce_motion_controller.dart';

/// Same fade/scale-in treatment as [EmptyView] — network and generic
/// errors are common enough (any screen's first load can hit one) that a
/// static pop-in would stand out against the rest of the app's motion.
class ErrorView extends ConsumerWidget {
  const ErrorView({
    super.key,
    required this.title,
    required this.message,
    this.retryLabel,
    this.onRetry,
  });

  final String title;
  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;

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
                  color: theme.colorScheme.error.withValues(alpha: 0.12),
                  border: Border.all(
                    color: theme.colorScheme.error.withValues(alpha: 0.28),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: theme.colorScheme.error.withValues(alpha: 0.12),
                      blurRadius: 18,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    Icons.error_outline_rounded,
                    size: 38,
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                title,
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              if (onRetry != null) ...[
                const SizedBox(height: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(retryLabel ?? 'Retry'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
