import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';
import '../../payments/application/payments_providers.dart';
import '../application/orders_providers.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.game,
    required this.product,
    required this.playerId,
    required this.serverId,
  });

  final Game game;
  final Product product;
  final String playerId;
  final String serverId;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  // Generated once when the screen is built, not per tap, so a retried
  // "Buy now" after a timeout is still deduped by the backend.
  late final String _idempotencyKey = generateIdempotencyKey();
  bool _submitting = false;
  String? _errorMessage;

  Future<void> _buyNow() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      final order = await ref
          .read(ordersApiProvider)
          .createOrder(
            gameId: widget.game.id,
            productId: widget.product.id,
            playerId: widget.playerId,
            serverId: widget.serverId,
            idempotencyKey: _idempotencyKey,
          );

      await ref
          .read(paymentsApiProvider)
          .createPayment(orderId: order.id, idempotencyKey: '$_idempotencyKey-pay');

      if (mounted) context.go('/orders/${order.id}');
    } catch (error) {
      final failure = Failure.from(error);
      setState(() {
        _errorMessage = failure.isNetworkError ? l10n.errorNoConnectionMessage : failure.message;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.checkoutTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  children: [
                    _SummaryRow(label: l10n.checkoutGameLabel, value: widget.game.name),
                    _SummaryRow(label: l10n.checkoutProductLabel, value: widget.product.name),
                    _SummaryRow(label: l10n.checkoutPlayerIdLabel, value: widget.playerId),
                    if (widget.serverId.isNotEmpty)
                      _SummaryRow(label: l10n.checkoutServerIdLabel, value: widget.serverId),
                    _SummaryRow(
                      label: l10n.checkoutPriceLabel,
                      value: formatMoney(widget.product.amountMinor, widget.product.currency, localeName),
                    ),
                    _SummaryRow(
                      label: l10n.checkoutPaymentMethodLabel,
                      value: l10n.checkoutMockPaymentLabel,
                    ),
                    const Divider(height: AppSpacing.lg),
                    _SummaryRow(
                      label: l10n.checkoutTotalLabel,
                      value: formatMoney(widget.product.amountMinor, widget.product.currency, localeName),
                      emphasize: true,
                    ),
                  ],
                ),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(_errorMessage!, style: TextStyle(color: theme.colorScheme.error)),
            ],
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: _submitting ? null : _buyNow,
              child: _submitting
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(l10n.checkoutCreatingOrder),
                      ],
                    )
                  : Text(l10n.checkoutBuyNowButton),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value, this.emphasize = false});

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = emphasize
        ? theme.textTheme.titleMedium
        : theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Flexible(
            child: Text(
              value,
              style: emphasize ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
