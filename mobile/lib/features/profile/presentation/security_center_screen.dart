import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../core/errors/failure.dart';
import '../../../core/network/api_exception.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/sessions_provider.dart';
import '../../auth/domain/session.dart';

class SecurityCenterScreen extends ConsumerWidget {
  const SecurityCenterScreen({super.key});

  Future<void> _confirmLogoutAll(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.securityLogoutAllConfirmTitle),
        content: Text(l10n.securityLogoutAllConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.securityLogoutAllButton),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(authApiProvider).logoutAllDevices();
      await ref.read(authControllerProvider.notifier).logout();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(Failure.from(error).message)));
    }
  }

  Future<void> _confirmDeleteAccount(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.securityDeleteAccountConfirmTitle),
        content: Text(l10n.securityDeleteAccountConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.securityDeleteAccountButton),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(authApiProvider).requestAccountDeletion();
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.securityDeleteAccountSuccessMessage)),
      );
      await ref.read(authControllerProvider.notifier).logout();
    } catch (error) {
      final message = error is ApiException && error.code == 'WALLET_NOT_EMPTY'
          ? l10n.securityDeleteAccountWalletNotEmptyMessage
          : Failure.from(error).message;
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final user = ref.watch(authControllerProvider).value?.user;
    final sessionsAsync = ref.watch(sessionsProvider);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.securityCenterTitle)),
      body: SafeArea(
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
              Text(
                l10n.securityAccountSection,
                style: theme.textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Column(
                  children: [
                    if (user?.email != null)
                      _AccountInfoRow(
                        icon: Icons.email_outlined,
                        title: l10n.securityEmailLabel,
                        subtitle: user!.email!,
                        showDivider: true,
                      ),
                    _AccountInfoRow(
                      icon: Icons.g_mobiledata_rounded,
                      iconColor: user?.hasGoogleAccount == true
                          ? theme.colorScheme.primary
                          : null,
                      title: user?.hasGoogleAccount == true
                          ? l10n.securityGoogleLinkedLabel
                          : l10n.securityGoogleNotLinkedLabel,
                      trailing: user?.hasGoogleAccount == true
                          ? Icon(
                              Icons.check_circle_rounded,
                              color: theme.colorScheme.primary,
                              size: 20,
                            )
                          : null,
                      showDivider: false,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                l10n.securitySessionsSection,
                style: theme.textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              sessionsAsync.when(
                loading: () => const Column(
                  children: [
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
                    title: l10n.errorGenericTitle,
                    message: failure.message,
                    retryLabel: l10n.commonRetry,
                    onRetry: () => ref.invalidate(sessionsProvider),
                  );
                },
                data: (sessions) {
                  if (sessions.isEmpty) {
                    return EmptyView(title: l10n.securitySessionsEmpty);
                  }
                  return Column(
                    children: [
                      for (final (index, session) in sessions.indexed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: StaggeredEntrance(
                            index: index,
                            child: _SessionTile(session: session),
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              OutlinedButton.icon(
                onPressed: () => _confirmLogoutAll(context, ref),
                icon: Icon(
                  Icons.logout_rounded,
                  color: theme.colorScheme.error,
                ),
                label: Text(
                  l10n.securityLogoutAllButton,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer.withValues(
                    alpha: isDark ? 0.18 : 0.35,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(
                    color: theme.colorScheme.error.withValues(alpha: 0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l10n.securityDeleteAccountSection,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: theme.colorScheme.error,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton.icon(
                      onPressed: () => _confirmDeleteAccount(context, ref),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: theme.colorScheme.error),
                      ),
                      icon: Icon(
                        Icons.delete_forever_outlined,
                        color: theme.colorScheme.error,
                      ),
                      label: Text(
                        l10n.securityDeleteAccountButton,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountInfoRow extends StatelessWidget {
  const _AccountInfoRow({
    required this.icon,
    required this.title,
    this.iconColor,
    this.subtitle,
    this.trailing,
    required this.showDivider,
  });

  final IconData icon;
  final Color? iconColor;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(icon, color: iconColor),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: theme.textTheme.bodyMedium),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            indent: AppSpacing.md,
            endIndent: AppSpacing.md,
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
          ),
      ],
    );
  }
}

class _SessionTile extends ConsumerWidget {
  const _SessionTile({required this.session});

  final Session session;

  String _deviceLabel(AppLocalizations l10n, String? userAgent) {
    if (userAgent == null || userAgent.isEmpty) {
      return l10n.securityDeviceUnknown;
    }
    if (userAgent.contains('Android')) return l10n.securityDeviceAndroid;
    if (userAgent.contains('iPhone') || userAgent.contains('iOS')) {
      return l10n.securityDeviceIphone;
    }
    if (userAgent.contains('Windows')) return l10n.securityDeviceWindows;
    if (userAgent.contains('Macintosh')) return l10n.securityDeviceMac;
    return userAgent.length > 40 ? '${userAgent.substring(0, 40)}…' : userAgent;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: session.isCurrent
            ? theme.colorScheme.primary.withValues(alpha: 0.06)
            : theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: session.isCurrent
              ? theme.colorScheme.primary.withValues(alpha: 0.4)
              : theme.colorScheme.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: session.isCurrent
                  ? theme.colorScheme.primary.withValues(alpha: 0.16)
                  : theme.colorScheme.surfaceContainerHighest.withValues(
                      alpha: 0.6,
                    ),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(
              Icons.devices_rounded,
              size: 18,
              color: session.isCurrent
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        _deviceLabel(l10n, session.userAgent),
                        style: theme.textTheme.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (session.isCurrent) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          l10n.securitySessionCurrentBadge,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  session.ipAddress ?? '',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          // Revoking your own current session here — rather than the
          // dedicated "Log out" action — would silently break the app the
          // moment its access token expires, with no warning at the point
          // of the tap. Simplest safe behavior: only offer it for every
          // *other* session.
          if (!session.isCurrent)
            TextButton(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ref.read(authApiProvider).revokeSession(session.id);
                  ref.invalidate(sessionsProvider);
                } catch (error) {
                  messenger.showSnackBar(
                    SnackBar(content: Text(Failure.from(error).message)),
                  );
                }
              },
              child: Text(l10n.securitySessionRevokeButton),
            ),
        ],
      ),
    );
  }
}
