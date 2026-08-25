import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/notifications/notification_permission_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/utils/support_launcher.dart';
import '../../../core/widgets/animated_balance.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/segmented_pill.dart';
import '../../../core/widgets/skeleton_box.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/app_user.dart';
import '../../orders/application/orders_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import 'widgets/public_id_row.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.authLogoutConfirmTitle),
        content: Text(l10n.authLogoutConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.authLogoutButton),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final authState = ref.watch(authControllerProvider).value;
    final isAuthenticated = authState?.isAuthenticated ?? false;
    final locale = ref.watch(localeControllerProvider);
    final themeMode = ref.watch(themeModeControllerProvider);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: TweenAnimationBuilder<double>(
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
            if (isAuthenticated) ...[
              _HeaderCard(user: authState!.user!),
              const SizedBox(height: AppSpacing.md),
              _StatsRow(),
              const SizedBox(height: AppSpacing.lg),
              _MenuSection(
                children: [
                  _MenuRow(
                    icon: Icons.account_balance_wallet_outlined,
                    label: l10n.profileWallet,
                    onTap: () => context.push('/wallet/history'),
                  ),
                  _MenuRow(
                    icon: Icons.receipt_long_outlined,
                    label: l10n.profileOrderHistory,
                    onTap: () => context.go('/orders'),
                  ),
                  _MenuRow(
                    icon: Icons.notifications_outlined,
                    label: l10n.profileNotifications,
                    onTap: () => context.push('/notifications'),
                  ),
                  _MenuRow(
                    icon: Icons.shield_outlined,
                    label: l10n.profileSecurityCenter,
                    onTap: () => context.push('/security'),
                  ),
                  _MenuRow(
                    icon: Icons.support_agent_rounded,
                    label: l10n.profileSupport,
                    onTap: () => launchSupportContact(
                      subject: l10n.supportGeneralSubject,
                      body: l10n.supportGeneralBody,
                    ),
                  ),
                ],
              ),
            ] else ...[
              _GuestCard(),
            ],

            const SizedBox(height: AppSpacing.xl),
            Text(
              l10n.settingsLanguage,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            SegmentedPill<Locale>(
              segments: [
                (const Locale('uz'), l10n.languageUzbek),
                (const Locale('ru'), l10n.languageRussian),
              ],
              selected: locale,
              onChanged: (value) =>
                  ref.read(localeControllerProvider.notifier).setLocale(value),
            ),

            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.settingsTheme,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            SegmentedPill<ThemeMode>(
              segments: [
                (ThemeMode.light, l10n.settingsThemeLight),
                (ThemeMode.dark, l10n.settingsThemeDark),
                (ThemeMode.system, l10n.settingsThemeSystem),
              ],
              selected: themeMode,
              onChanged: (value) => ref
                  .read(themeModeControllerProvider.notifier)
                  .setThemeMode(value),
            ),

            const SizedBox(height: AppSpacing.lg),
            _SwitchSettingRow(
              title: l10n.settingsNotifications,
              description: l10n.settingsNotificationsDescription,
              value: ref.watch(notificationPermissionProvider).value ?? false,
              onChanged: (wantEnabled) => ref
                  .read(notificationPermissionProvider.notifier)
                  .setEnabled(wantEnabled),
            ),

            const SizedBox(height: AppSpacing.sm),
            _SwitchSettingRow(
              title: l10n.settingsReduceMotion,
              description: l10n.settingsReduceMotionDescription,
              value: reduceMotion,
              onChanged: (value) => ref
                  .read(reduceMotionProvider.notifier)
                  .setReduceMotion(value),
            ),

            if (isAuthenticated) ...[
              const SizedBox(height: AppSpacing.xl),
              OutlinedButton.icon(
                onPressed: () => _confirmLogout(context, ref),
                icon: const Icon(Icons.logout_rounded),
                label: Text(l10n.profileLogoutButton),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              UserAvatar(avatarUrl: user.avatarUrl),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      user.displayName ?? user.email ?? user.phone ?? '',
                      style: theme.textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      user.email ?? user.phone ?? '',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
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
          PublicIdRow(publicId: user.publicId),
        ],
      ),
    );
  }
}

class _StatsRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final walletAsync = ref.watch(walletProvider);
    final ordersAsync = ref.watch(myOrdersProvider);

    return Row(
      children: [
        Expanded(
          child: _StatTile(
            label: l10n.walletBalanceLabel,
            value: walletAsync.when(
              loading: () => const SkeletonBox(width: 70, height: 20),
              error: (_, _) => const Text('—'),
              data: (wallet) => AnimatedBalance(
                amountMinor: wallet.balanceMinor,
                currency: wallet.currency,
                localeName: localeName,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: _StatTile(
            label: l10n.profileStatOrders,
            value: ordersAsync.when(
              loading: () => const SkeletonBox(width: 30, height: 20),
              error: (_, _) => const Text('—'),
              data: (orders) => Text(
                '${orders.length}',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 2),
          value,
        ],
      ),
    );
  }
}

class _MenuSection extends StatelessWidget {
  const _MenuSection({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final (index, child) in children.indexed) ...[
          StaggeredEntrance(index: index, child: child),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Each row's icon gets its own tinted badge, cycling through the same
    // brand-derived gradient family used for game-cover fallback tiles — a
    // row of identical grey outline icons read as flat; a row of distinct
    // (but still on-brand) colors reads as considered, not random.
    final gradient = AppColors
        .tileGradients[icon.hashCode.abs() % AppColors.tileGradients.length];

    return PressableScale(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: gradient,
                ),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(icon, color: Colors.white, size: 19),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
            Icon(
              Icons.chevron_right_rounded,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }
}

class _SwitchSettingRow extends StatelessWidget {
  const _SwitchSettingRow({
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: theme.textTheme.bodyMedium),
                Text(
                  description,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _GuestCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        children: [
          Text(l10n.profileGuestTitle, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.profileGuestMessage,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.push('/login'),
                  child: Text(l10n.profileLoginButton),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton(
                  onPressed: () => context.push('/register'),
                  child: Text(l10n.profileRegisterButton),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
