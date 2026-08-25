import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';
import '../../payments/application/payments_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../application/orders_providers.dart';

enum _PaymentMethod { wallet, payme, click, mock }

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
  _PaymentMethod _method = _PaymentMethod.wallet;
  bool _submitting = false;
  String? _errorMessage;
  bool _insufficientBalance = false;

  Future<void> _buyNow() async {
    HapticFeedback.mediumImpact();
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
      _insufficientBalance = false;
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

      if (_method == _PaymentMethod.wallet) {
        await ref
            .read(paymentsApiProvider)
            .payWithWallet(
              orderId: order.id,
              idempotencyKey: '$_idempotencyKey-pay',
            );
      } else {
        await ref
            .read(paymentsApiProvider)
            .createPayment(
              orderId: order.id,
              idempotencyKey: '$_idempotencyKey-pay',
              providerCode: switch (_method) {
                _PaymentMethod.payme => 'PAYME',
                _PaymentMethod.click => 'CLICK',
                _PaymentMethod.mock => 'DEV_MOCK_PAYMENT',
                _PaymentMethod.wallet => throw StateError('handled above'),
              },
            );
      }

      if (mounted) context.go('/orders/${order.id}');
    } catch (error) {
      final failure = Failure.from(error);
      setState(() {
        _insufficientBalance = failure.code == 'INSUFFICIENT_BALANCE';
        _errorMessage = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : (_insufficientBalance
                  ? l10n.checkoutInsufficientBalanceMessage
                  : failure.message);
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
    final walletAsync = ref.watch(walletProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.checkoutTitle)),
      body: SafeArea(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: AppMotion.entrance,
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
              _OrderSummaryCard(
                game: widget.game,
                product: widget.product,
                playerId: widget.playerId,
                serverId: widget.serverId,
                localeName: localeName,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.checkoutPaymentMethodLabel,
                style: theme.textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final (index, entry)
                  in <(_PaymentMethod, IconData, String, String?)>[
                    (
                      _PaymentMethod.wallet,
                      Icons.account_balance_wallet_outlined,
                      l10n.checkoutPayWithWalletLabel,
                      walletAsync.when(
                        loading: () => null,
                        error: (_, _) => null,
                        data: (wallet) => l10n.checkoutPayWithWalletBalance(
                          formatMoney(
                            wallet.balanceMinor,
                            wallet.currency,
                            localeName,
                          ),
                        ),
                      ),
                    ),
                    (
                      _PaymentMethod.payme,
                      Icons.qr_code_rounded,
                      l10n.checkoutPayWithPaymeLabel,
                      l10n.checkoutPayWithPaymeSubtitle,
                    ),
                    (
                      _PaymentMethod.click,
                      Icons.touch_app_rounded,
                      l10n.checkoutPayWithClickLabel,
                      l10n.checkoutPayWithClickSubtitle,
                    ),
                  ].indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: StaggeredEntrance(
                    index: index,
                    child: _PaymentMethodTile(
                      icon: entry.$2,
                      title: entry.$3,
                      subtitle: entry.$4,
                      selected: _method == entry.$1,
                      onTap: () => setState(() {
                        _method = entry.$1;
                        _errorMessage = null;
                        _insufficientBalance = false;
                      }),
                    ),
                  ),
                ),
              if (kDebugMode)
                Padding(
                  padding: const EdgeInsets.only(top: 2, bottom: AppSpacing.sm),
                  child: TextButton.icon(
                    onPressed: () => setState(() {
                      _method = _PaymentMethod.mock;
                      _errorMessage = null;
                      _insufficientBalance = false;
                    }),
                    icon: Icon(
                      _method == _PaymentMethod.mock
                          ? Icons.check_circle_rounded
                          : Icons.bug_report_outlined,
                      size: 16,
                    ),
                    label: Text(l10n.checkoutMockPaymentLabel),
                  ),
                ),
              if (_errorMessage != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _errorMessage!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
                if (_insufficientBalance) ...[
                  const SizedBox(height: AppSpacing.sm),
                  OutlinedButton(
                    onPressed: () => context.push('/wallet/topup'),
                    child: Text(l10n.checkoutTopUpNowButton),
                  ),
                ],
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
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
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
      ),
    );
  }
}

/// Order summary as a bordered, softly-shadowed card matching the rest of
/// the app's card language, with a gradient product icon up top — replaces
/// a plain Material [Card] that looked flat next to everything else on this
/// screen.
class _OrderSummaryCard extends StatelessWidget {
  const _OrderSummaryCard({
    required this.game,
    required this.product,
    required this.playerId,
    required this.serverId,
    required this.localeName,
  });

  final Game game;
  final Product product;
  final String playerId;
  final String serverId;
  final String localeName;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: gradient),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  boxShadow: [
                    BoxShadow(
                      color: gradient.first.withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.diamond_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      style: theme.textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      game.name,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(label: l10n.checkoutPlayerIdLabel, value: playerId),
          if (serverId.isNotEmpty)
            _SummaryRow(label: l10n.checkoutServerIdLabel, value: serverId),
          _SummaryRow(
            label: l10n.checkoutPriceLabel,
            value: formatMoney(
              product.amountMinor,
              product.currency,
              localeName,
            ),
          ),
          const Divider(height: AppSpacing.lg),
          _SummaryRow(
            label: l10n.checkoutTotalLabel,
            value: formatMoney(
              product.amountMinor,
              product.currency,
              localeName,
            ),
            emphasize: true,
          ),
        ],
      ),
    );
  }
}

class _PaymentMethodTile extends StatelessWidget {
  const _PaymentMethodTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return PressableScale(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: AnimatedContainer(
        duration: AppMotion.fast,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected
              ? theme.colorScheme.primary.withValues(alpha: 0.08)
              : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.outlineVariant,
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: gradient.first.withValues(alpha: 0.18),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: AppMotion.fast,
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: selected ? LinearGradient(colors: gradient) : null,
                color: selected
                    ? null
                    : theme.colorScheme.surfaceContainerHighest.withValues(
                        alpha: 0.6,
                      ),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(
                icon,
                size: 18,
                color: selected
                    ? Colors.white
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: theme.textTheme.titleSmall),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            AnimatedSwitcher(
              duration: AppMotion.fast,
              child: selected
                  ? Icon(
                      Icons.check_circle_rounded,
                      key: const ValueKey(true),
                      color: theme.colorScheme.primary,
                    )
                  : Icon(
                      Icons.circle_outlined,
                      key: const ValueKey(false),
                      size: 20,
                      color: theme.colorScheme.outlineVariant,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = emphasize
        ? theme.textTheme.titleMedium
        : theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Flexible(
            child: Text(
              value,
              style: emphasize
                  ? theme.textTheme.titleMedium
                  : theme.textTheme.bodyMedium,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
