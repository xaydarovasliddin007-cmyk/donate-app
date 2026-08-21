import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/order_status.dart';

(Color, String) _statusVisuals(BuildContext context, OrderStatus status) {
  return (_statusColor(status), orderStatusLabel(context, status));
}

Color _statusColor(OrderStatus status) => switch (status) {
  OrderStatus.pending => AppColors.warning,
  OrderStatus.paid => AppColors.brandPrimary,
  OrderStatus.processing => AppColors.brandPrimary,
  OrderStatus.completed => AppColors.success,
  OrderStatus.failed => AppColors.danger,
  OrderStatus.cancelled => AppColors.danger,
  OrderStatus.refunded => AppColors.warning,
};

/// Public so other screens (e.g. the "Contact support" pre-filled message)
/// can reuse the same localized status text instead of re-deriving it.
String orderStatusLabel(BuildContext context, OrderStatus status) {
  final l10n = AppLocalizations.of(context);
  return switch (status) {
    OrderStatus.pending => l10n.orderStatusPending,
    OrderStatus.paid => l10n.orderStatusPaid,
    OrderStatus.processing => l10n.orderStatusProcessing,
    OrderStatus.completed => l10n.orderStatusCompleted,
    OrderStatus.failed => l10n.orderStatusFailed,
    OrderStatus.cancelled => l10n.orderStatusCancelled,
    OrderStatus.refunded => l10n.orderStatusRefunded,
  };
}

class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({super.key, required this.status});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    final (color, label) = _statusVisuals(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
