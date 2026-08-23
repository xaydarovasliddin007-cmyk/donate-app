import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
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
    if (confirmed == true) {
      await ref.read(authApiProvider).logoutAllDevices();
      await ref.read(authControllerProvider.notifier).logout();
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
    final user = ref.watch(authControllerProvider).value?.user;
    final sessionsAsync = ref.watch(sessionsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.securityCenterTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text(
              l10n.securityAccountSection,
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Card(
              child: Column(
                children: [
                  if (user?.email != null)
                    ListTile(
                      leading: const Icon(Icons.email_outlined),
                      title: Text(l10n.securityEmailLabel),
                      subtitle: Text(user!.email!),
                    ),
                  ListTile(
                    leading: Icon(
                      Icons.g_mobiledata_rounded,
                      color: user?.hasGoogleAccount == true
                          ? theme.colorScheme.primary
                          : null,
                    ),
                    title: Text(
                      user?.hasGoogleAccount == true
                          ? l10n.securityGoogleLinkedLabel
                          : l10n.securityGoogleNotLinkedLabel,
                    ),
                    trailing: user?.hasGoogleAccount == true
                        ? Icon(
                            Icons.check_circle_rounded,
                            color: theme.colorScheme.primary,
                            size: 20,
                          )
                        : null,
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
                    for (final session in sessions)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: _SessionTile(session: session),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: AppSpacing.xl),
            OutlinedButton.icon(
              onPressed: () => _confirmLogoutAll(context, ref),
              icon: Icon(Icons.logout_rounded, color: theme.colorScheme.error),
              label: Text(
                l10n.securityLogoutAllButton,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              l10n.securityDeleteAccountSection,
              style: theme.textTheme.titleSmall,
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
    );
  }
}

class _SessionTile extends ConsumerWidget {
  const _SessionTile({required this.session});

  final Session session;

  String _deviceLabel(String? userAgent) {
    if (userAgent == null || userAgent.isEmpty) return 'Unknown device';
    if (userAgent.contains('Android')) return 'Android device';
    if (userAgent.contains('iPhone') || userAgent.contains('iOS')) {
      return 'iPhone';
    }
    if (userAgent.contains('Windows')) return 'Windows';
    if (userAgent.contains('Macintosh')) return 'Mac';
    return userAgent.length > 40 ? '${userAgent.substring(0, 40)}…' : userAgent;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Icon(
            Icons.devices_rounded,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _deviceLabel(session.userAgent),
                  style: theme.textTheme.titleSmall,
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
          TextButton(
            onPressed: () async {
              await ref.read(authApiProvider).revokeSession(session.id);
              ref.invalidate(sessionsProvider);
            },
            child: Text(l10n.securitySessionRevokeButton),
          ),
        ],
      ),
    );
  }
}
