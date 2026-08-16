import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/order_status.dart';

/// A 3-step "Payment → Processing → Completed" progress row for the
/// in-flight states. FAILED/CANCELLED/REFUNDED aren't points on that same
/// line — they're a different outcome — so those render as a single alert
/// row instead of a partially-filled stepper, which would misleadingly
/// imply the order is still moving forward.
class OrderProgressTimeline extends StatelessWidget {
  const OrderProgressTimeline({super.key, required this.status});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    if (status == OrderStatus.failed || status == OrderStatus.cancelled || status == OrderStatus.refunded) {
      return _OutcomeBanner(status: status);
    }

    final l10n = AppLocalizations.of(context);
    final stepIndex = switch (status) {
      OrderStatus.pending => 0,
      OrderStatus.paid => 1,
      OrderStatus.processing => 1,
      OrderStatus.completed => 2,
      _ => 0,
    };
    final labels = [l10n.orderStatusPaid, l10n.orderStatusProcessing, l10n.orderStatusCompleted];

    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          _StepDot(label: labels[i], reached: i <= stepIndex, active: i == stepIndex),
          if (i != labels.length - 1) _StepConnector(filled: i < stepIndex),
        ],
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.label, required this.reached, required this.active});

  final String label;
  final bool reached;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = reached ? theme.colorScheme.primary : theme.colorScheme.outlineVariant;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: AppMotion.medium,
          curve: AppMotion.standard,
          width: active ? 16 : 12,
          height: active ? 16 : 12,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: reached ? color : Colors.transparent,
            border: Border.all(color: color, width: 2),
          ),
          child: reached && !active
              ? const Icon(Icons.check_rounded, size: 9, color: Colors.white)
              : null,
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: reached ? theme.colorScheme.onSurface : theme.colorScheme.onSurfaceVariant,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _StepConnector extends StatelessWidget {
  const _StepConnector({required this.filled});

  final bool filled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: AnimatedContainer(
          duration: AppMotion.medium,
          height: 2,
          color: filled ? theme.colorScheme.primary : theme.colorScheme.outlineVariant,
        ),
      ),
    );
  }
}

class _OutcomeBanner extends StatelessWidget {
  const _OutcomeBanner({required this.status});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final (icon, color, label) = switch (status) {
      OrderStatus.failed => (Icons.error_rounded, AppColors.danger, l10n.orderStatusFailed),
      OrderStatus.cancelled => (Icons.block_rounded, AppColors.danger, l10n.orderStatusCancelled),
      OrderStatus.refunded => (Icons.replay_rounded, AppColors.warning, l10n.orderStatusRefunded),
      _ => (Icons.info_rounded, theme.colorScheme.primary, ''),
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(label, style: theme.textTheme.titleSmall?.copyWith(color: color)),
          ),
        ],
      ),
    );
  }
}
