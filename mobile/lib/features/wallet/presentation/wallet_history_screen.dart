import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/wallet_providers.dart';
import '../domain/wallet.dart';

class WalletHistoryScreen extends ConsumerWidget {
  const WalletHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final transactionsAsync = ref.watch(walletTransactionsProvider);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.walletTransactionHistoryTitle)),
      body: SafeArea(
        child: transactionsAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: const [
              Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: ListRowSkeleton(),
              ),
              Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: ListRowSkeleton(),
              ),
              ListRowSkeleton(),
            ],
          ),
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
              onRetry: () => ref.invalidate(walletTransactionsProvider),
            );
          },
          data: (transactions) {
            if (transactions.isEmpty) {
              return EmptyView(title: l10n.walletTransactionHistoryEmpty);
            }
            return TweenAnimationBuilder<double>(
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
              child: ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.lg),
                itemCount: transactions.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, index) => StaggeredEntrance(
                  index: index,
                  child: _TransactionTile(transaction: transactions[index]),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final WalletTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final isCredit = transaction.direction == WalletTransactionDirection.credit;
    final sign = isCredit ? '+' : '−';
    final color = isCredit ? AppColors.success : theme.colorScheme.onSurface;

    final typeLabel = switch (transaction.type) {
      WalletTransactionType.topup => l10n.walletTypeTopup,
      WalletTransactionType.purchase => l10n.walletTypePurchase,
      WalletTransactionType.refund => l10n.walletTypeRefund,
      WalletTransactionType.adjustment => l10n.walletTypeAdjustment,
      WalletTransactionType.bonus => l10n.walletTypeBonus,
    };

    final icon = switch (transaction.type) {
      WalletTransactionType.topup => Icons.add_card_rounded,
      WalletTransactionType.purchase => Icons.shopping_bag_outlined,
      WalletTransactionType.refund => Icons.replay_rounded,
      WalletTransactionType.adjustment => Icons.tune_rounded,
      WalletTransactionType.bonus => Icons.card_giftcard_rounded,
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isCredit
                  ? AppColors.success.withValues(alpha: 0.14)
                  : theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            alignment: Alignment.center,
            child: Icon(
              icon,
              size: 20,
              color: isCredit
                  ? AppColors.success
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  transaction.reason ?? transaction.reference ?? typeLabel,
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  '$typeLabel · ${_formatDate(transaction.createdAt)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$sign${formatMoney(transaction.amountMinor, transaction.currency, localeName)}',
            style: theme.textTheme.titleSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  static String _twoDigits(int n) => n.toString().padLeft(2, '0');

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    return '${_twoDigits(local.day)}.${_twoDigits(local.month)}.${local.year} '
        '${_twoDigits(local.hour)}:${_twoDigits(local.minute)}';
  }
}
