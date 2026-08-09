import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../payments/application/payments_providers.dart';
import '../application/orders_providers.dart';
import '../domain/order_status.dart';
import 'widgets/order_status_badge.dart';

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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final orderAsync = ref.watch(orderByIdProvider(widget.orderId));

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
            title: failure.isNetworkError ? l10n.errorNoConnectionTitle : l10n.errorGenericTitle,
            message: failure.isNetworkError ? l10n.errorNoConnectionMessage : l10n.errorGenericMessage,
            retryLabel: l10n.commonRetry,
            onRetry: () => ref.invalidate(orderByIdProvider(widget.orderId)),
          );
        },
        data: (order) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(orderByIdProvider(widget.orderId)),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Center(child: OrderStatusBadge(status: order.status)),
              const SizedBox(height: AppSpacing.lg),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    children: [
                      _Row(label: l10n.orderNumberLabel, value: order.orderNumber),
                      _Row(label: l10n.checkoutGameLabel, value: order.game.name),
                      _Row(label: l10n.checkoutProductLabel, value: order.items.first.productName),
                      _Row(label: l10n.orderPlayerIdLabel, value: order.playerId),
                      _Row(
                        label: l10n.orderAmountLabel,
                        value: formatMoney(
                          order.amountMinor,
                          order.currency,
                          Localizations.localeOf(context).toString(),
                        ),
                      ),
                      _Row(
                        label: l10n.orderCreatedAtLabel,
                        value: DateFormat.yMd().add_Hm().format(order.createdAt.toLocal()),
                      ),
                      if (order.failureReason != null)
                        _Row(label: l10n.orderFailureReasonLabel, value: order.failureReason!),
                    ],
                  ),
                ),
              ),
              if (order.status == OrderStatus.pending && order.latestPaymentId != null)
                _DevPaymentSimulator(orderId: order.id, paymentId: order.latestPaymentId!),
            ],
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          Flexible(child: Text(value, textAlign: TextAlign.end)),
        ],
      ),
    );
  }
}

class _DevPaymentSimulator extends ConsumerStatefulWidget {
  const _DevPaymentSimulator({required this.orderId, required this.paymentId});

  final String orderId;
  final String paymentId;

  @override
  ConsumerState<_DevPaymentSimulator> createState() => _DevPaymentSimulatorState();
}

class _DevPaymentSimulatorState extends ConsumerState<_DevPaymentSimulator> {
  bool _submitting = false;

  Future<void> _simulate(bool succeed) async {
    setState(() => _submitting = true);
    try {
      await ref.read(paymentsApiProvider).simulateWebhook(widget.paymentId, succeed: succeed);
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
              Text(l10n.paymentDevSimulateTitle, style: theme.textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              Text(l10n.paymentDevSimulateMessage, style: theme.textTheme.bodySmall),
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
