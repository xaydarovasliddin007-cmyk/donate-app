import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/animated_balance.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../application/wallet_providers.dart';

/// The home screen's centerpiece for signed-in users: current UZDONATE
/// balance + a one-tap top-up CTA. Deliberately the first thing an
/// authenticated user sees, per the product's "wallet-first" home design.
class WalletBalanceCard extends ConsumerStatefulWidget {
  const WalletBalanceCard({super.key});

  @override
  ConsumerState<WalletBalanceCard> createState() => _WalletBalanceCardState();
}

class _WalletBalanceCardState extends ConsumerState<WalletBalanceCard> {
  // Session-only (not persisted) — a fintech-app staple: hide the balance
  // from over-the-shoulder glances without it needing to survive app
  // restarts, since it always starts visible again next launch.
  bool _hidden = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final walletAsync = ref.watch(walletProvider);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: AppMotion.entrance,
      curve: AppMotion.standard,
      builder: (context, t, child) {
        return Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, (1 - t) * 10), child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  l10n.walletBalanceLabel,
                  style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
                const Spacer(),
                InkWell(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  onTap: () => setState(() => _hidden = !_hidden),
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(
                      _hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      size: 18,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            AnimatedSwitcher(
              duration: AppMotion.fast,
              child: _hidden
                  ? Text(
                      '••••••',
                      key: const ValueKey('hidden'),
                      style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                    )
                  : walletAsync.when(
                      loading: () => const SkeletonBox(key: ValueKey('loading'), width: 160, height: 32),
                      error: (_, _) => Text('—', key: const ValueKey('error'), style: theme.textTheme.headlineMedium),
                      data: (wallet) => AnimatedBalance(
                        key: const ValueKey('visible'),
                        amountMinor: wallet.balanceMinor,
                        currency: wallet.currency,
                        localeName: localeName,
                        style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => context.push('/wallet/topup'),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: Text(l10n.walletTopUpButton),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
