import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/reduce_motion_controller.dart';
import '../../../../core/utils/support_launcher.dart';
import '../../../../core/widgets/animated_balance.dart';
import '../../../../core/widgets/card_sheen.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../../../core/widgets/skeleton_box.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/wallet_providers.dart';

/// The home screen's centerpiece for signed-in users — the very first thing
/// authenticated users see: their own UZDONATE balance, rendered as a real
/// virtual card (brand mark, public ID, holder name) rather than a plain
/// balance figure, with one-tap actions below it.
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
    final isDark = theme.brightness == Brightness.dark;
    final localeName = Localizations.localeOf(context).toString();
    final walletAsync = ref.watch(walletProvider);
    final user = ref.watch(authControllerProvider).value?.user;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;
    final reduceMotion = ref.watch(reduceMotionProvider);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: reduceMotion ? Duration.zero : AppMotion.fast,
      curve: AppMotion.standard,
      builder: (context, t, child) {
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 4),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 1.7,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  boxShadow: [
                    BoxShadow(
                      color: gradient.first.withValues(alpha: 0.35),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: CardSheen(
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  enabled: !reduceMotion,
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: gradient,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.16),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              'UZDONATE',
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1,
                              ),
                            ),
                            const Spacer(),
                            InkWell(
                              borderRadius: BorderRadius.circular(
                                AppRadius.pill,
                              ),
                              onTap: () => setState(() => _hidden = !_hidden),
                              child: Padding(
                                padding: const EdgeInsets.all(4),
                                child: Icon(
                                  _hidden
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: 18,
                                  color: Colors.white70,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Text(
                          l10n.walletBalanceLabel,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 2),
                        AnimatedSwitcher(
                          duration: AppMotion.fast,
                          child: _hidden
                              ? Text(
                                  '••••••',
                                  key: const ValueKey('hidden'),
                                  style: theme.textTheme.headlineSmall
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                )
                              : walletAsync.when(
                                  loading: () => SkeletonBox(
                                    key: const ValueKey('loading'),
                                    width: 140,
                                    height: 26,
                                    borderRadius: BorderRadius.circular(
                                      AppRadius.sm,
                                    ),
                                  ),
                                  error: (_, _) => Text(
                                    '—',
                                    key: const ValueKey('error'),
                                    style: theme.textTheme.headlineSmall
                                        ?.copyWith(color: Colors.white),
                                  ),
                                  data: (wallet) => AnimatedBalance(
                                    key: const ValueKey('visible'),
                                    amountMinor: wallet.balanceMinor,
                                    currency: wallet.currency,
                                    localeName: localeName,
                                    style: theme.textTheme.headlineSmall
                                        ?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                        ),
                                  ),
                                ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            Text(
                              user?.publicId ?? '',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.white,
                                letterSpacing: 1.2,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (user?.displayName != null) ...[
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  user!.displayName!,
                                  textAlign: TextAlign.end,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: Colors.white70,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: _QuickActionPill(
                    icon: Icons.add_rounded,
                    label: l10n.walletTopUpShortButton,
                    filled: true,
                    onTap: () => context.push('/wallet/topup'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _QuickActionPill(
                    icon: Icons.support_agent_rounded,
                    label: l10n.walletSupportButton,
                    filled: false,
                    onTap: () => launchSupportContact(
                      subject: l10n.supportGeneralSubject,
                      body: l10n.supportGeneralBody,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionPill extends StatelessWidget {
  const _QuickActionPill({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.filled,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  // One emphasized ("filled", brand gradient) action and one quiet/neutral
  // action — not a different accent color per pill. A row of pills each in
  // their own hue was the "too many mismatched colors" complaint; a single
  // gradient used once, deliberately, reads as a considered choice instead.
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return PressableScale(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: Container(
        decoration: BoxDecoration(
          gradient: filled
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradient,
                )
              : null,
          color: filled
              ? null
              : theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.6,
                ),
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: filled
              ? null
              : Border.all(color: theme.colorScheme.outlineVariant),
          boxShadow: filled
              ? [
                  BoxShadow(
                    color: gradient.first.withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: filled ? Colors.white : theme.colorScheme.onSurface,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: filled ? Colors.white : theme.colorScheme.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
