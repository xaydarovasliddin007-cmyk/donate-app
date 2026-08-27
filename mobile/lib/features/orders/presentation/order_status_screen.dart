import 'dart:async';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/utils/support_launcher.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/success_checkmark.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../../payments/application/payments_providers.dart';
import '../application/orders_providers.dart';
import '../domain/order.dart';
import '../domain/order_status.dart';
import 'widgets/order_progress_timeline.dart';
import 'widgets/order_status_badge.dart' show orderStatusLabel;

class OrderStatusScreen extends ConsumerStatefulWidget {
  const OrderStatusScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends ConsumerState<OrderStatusScreen> {
  Timer? _pollTimer;

  void _schedulePoll(OrderStatus status) {
    _pollTimer?.cancel();
    if (isTerminalOrderStatus(status)) return;
    // Lightweight stand-in for real-time push: cheap enough at this catalog
    // size, and stops the instant the order reaches a terminal status.
    _pollTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) ref.invalidate(orderByIdProvider(widget.orderId));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _contactSupport(Order order) async {
    final l10n = AppLocalizations.of(context);
    final publicId =
        ref.read(authControllerProvider).value?.user?.publicId ?? '—';
    final body = [
      '${l10n.profileUzdonateIdLabel}: $publicId',
      '${l10n.orderNumberLabel}: ${order.orderNumber}',
      '${l10n.checkoutGameLabel}: ${order.game.name}',
      '${l10n.checkoutProductLabel}: ${order.items.first.productName}',
      '${l10n.orderStatusLabel}: ${orderStatusLabel(context, order.status)}',
    ].join('\n');
    await launchSupportContact(
      subject: l10n.supportRequestSubject(order.orderNumber),
      body: body,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final orderAsync = ref.watch(orderByIdProvider(widget.orderId));
    final reduceMotion = ref.watch(reduceMotionProvider);

    ref.listen(orderByIdProvider(widget.orderId), (previous, next) {
      next.whenData((order) => _schedulePoll(order.status));
    });

    return Scaffold(
      appBar: AppBar(title: Text(l10n.orderStatusTitle)),
      body: orderAsync.when(
        loading: () => const LoadingView(),
        error: (error, _) {
          final failure = Failure.from(error);
          return ErrorView(
            title: failure.isNetworkError
                ? l10n.errorNoConnectionTitle
                : l10n.errorGenericTitle,
            message: failure.isNetworkError
                ? l10n.errorNoConnectionMessage
                : l10n.errorGenericMessage,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(orderByIdProvider(widget.orderId)),
          );
        },
        data: (order) => RefreshIndicator(
          onRefresh: () async =>
              ref.invalidate(orderByIdProvider(widget.orderId)),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: reduceMotion ? Duration.zero : AppMotion.entrance,
            curve: AppMotion.standard,
            builder: (context, t, child) => Opacity(
              opacity: t,
              child: Transform.translate(
                offset: Offset(0, (1 - t) * 12),
                child: child,
              ),
            ),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                if (order.status == OrderStatus.completed) ...[
                  const Center(child: SuccessCheckmark(size: 56)),
                  const SizedBox(height: AppSpacing.md),
                ],
                OrderProgressTimeline(status: order.status),
                const SizedBox(height: AppSpacing.lg),
                _OrderDetailCard(order: order),
                if (kDebugMode &&
                    order.status == OrderStatus.pending &&
                    order.latestPaymentId != null)
                  _DevPaymentSimulator(
                    orderId: order.id,
                    paymentId: order.latestPaymentId!,
                  ),
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton.icon(
                  onPressed: () => _contactSupport(order),
                  icon: const Icon(Icons.support_agent_outlined),
                  label: Text(l10n.orderContactSupportButton),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A "receipt" card: a gradient header carrying the game/product identity
/// and the big-ticket amount (the two things worth a glance), with the
/// reference details (order #, player ID, timestamp) as a plain list below
/// — replacing a single flat, undifferentiated stack of label/value rows
/// that gave the total no more visual weight than the order number.
class _OrderDetailCard extends StatelessWidget {
  const _OrderDetailCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return Container(
      clipBehavior: Clip.antiAlias,
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
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: gradient,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _OrderGameBadge(gameName: order.game.name),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            order.game.name,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            order.items.first.productName,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  formatMoney(
                    order.amountMinor,
                    order.currency,
                    Localizations.localeOf(context).toString(),
                  ),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Column(
              children: [
                _Row(label: l10n.orderNumberLabel, value: order.orderNumber),
                _Row(label: l10n.orderPlayerIdLabel, value: order.playerId),
                _Row(
                  label: l10n.orderCreatedAtLabel,
                  value: DateFormat.yMd().add_Hm().format(
                    order.createdAt.toLocal(),
                  ),
                  showDivider: order.failureReason == null,
                ),
                if (order.failureReason != null)
                  _Row(
                    label: l10n.orderFailureReasonLabel,
                    value: order.failureReason!,
                    valueColor: theme.colorScheme.error,
                    showDivider: false,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A translucent-on-gradient monogram badge (the game's first letter) —
/// same "no cover-art on hand" reasoning as [OrderCard]'s icon, styled to
/// sit on top of a colored gradient instead of a plain surface.
class _OrderGameBadge extends StatelessWidget {
  const _OrderGameBadge({required this.gameName});

  final String gameName;

  @override
  Widget build(BuildContext context) {
    final initial = gameName.trim().isEmpty
        ? '?'
        : gameName.trim()[0].toUpperCase();

    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Text(
        initial,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.value,
    this.valueColor,
    this.showDivider = true,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Flexible(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: valueColor,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
          ),
      ],
    );
  }
}

class _DevPaymentSimulator extends ConsumerStatefulWidget {
  const _DevPaymentSimulator({required this.orderId, required this.paymentId});

  final String orderId;
  final String paymentId;

  @override
  ConsumerState<_DevPaymentSimulator> createState() =>
      _DevPaymentSimulatorState();
}

class _DevPaymentSimulatorState extends ConsumerState<_DevPaymentSimulator> {
  bool _submitting = false;

  Future<void> _simulate(bool succeed) async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(paymentsApiProvider)
          .simulateWebhook(widget.paymentId, succeed: succeed);
    } catch (_) {
      // The order screen's own error state will surface on next refresh if this failed.
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
        ref.invalidate(orderByIdProvider(widget.orderId));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.lg),
      child: Card(
        color: theme.colorScheme.surfaceContainerHighest,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.paymentDevSimulateTitle,
                style: theme.textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.paymentDevSimulateMessage,
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.md),
              if (_submitting)
                const Center(child: LoadingView())
              else
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: () => _simulate(true),
                        child: Text(l10n.paymentDevSimulateSuccessButton),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _simulate(false),
                        child: Text(l10n.paymentDevSimulateFailButton),
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
