import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
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

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          if (isAuthenticated) ...[
            Card(
              child: ListTile(
                leading: _ProfileAvatar(avatarUrl: authState!.user!.avatarUrl),
                title: Text(authState.user!.displayName ?? authState.user!.email ?? authState.user!.phone ?? ''),
                subtitle: Text(authState.user!.email ?? authState.user!.phone ?? ''),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.account_balance_wallet_outlined),
                    title: Text(l10n.profileWallet),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/wallet/history'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: Text(l10n.profileOrderHistory),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.go('/orders'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.notifications_outlined),
                    title: Text(l10n.profileNotifications),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/notifications'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.shield_outlined),
                    title: Text(l10n.profileSecurityCenter),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/security'),
                  ),
                ],
              ),
            ),
          ] else ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  children: [
                    Text(l10n.profileGuestTitle, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      l10n.profileGuestMessage,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
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
              ),
            ),
          ],

          if (isAuthenticated) ...[
            const SizedBox(height: AppSpacing.xl),
            PublicIdRow(publicId: authState!.user!.publicId),
          ],

          const SizedBox(height: AppSpacing.xl),
          Text(l10n.settingsLanguage, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: AppSpacing.sm),
          SegmentedButton<Locale>(
            segments: [
              ButtonSegment(value: const Locale('uz'), label: Text(l10n.languageUzbek)),
              ButtonSegment(value: const Locale('ru'), label: Text(l10n.languageRussian)),
            ],
            selected: {locale},
            onSelectionChanged: (selection) {
              ref.read(localeControllerProvider.notifier).setLocale(selection.first);
            },
          ),

          const SizedBox(height: AppSpacing.lg),
          Text(l10n.settingsTheme, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: AppSpacing.sm),
          SegmentedButton<ThemeMode>(
            segments: [
              ButtonSegment(value: ThemeMode.light, label: Text(l10n.settingsThemeLight)),
              ButtonSegment(value: ThemeMode.dark, label: Text(l10n.settingsThemeDark)),
              ButtonSegment(value: ThemeMode.system, label: Text(l10n.settingsThemeSystem)),
            ],
            selected: {themeMode},
            onSelectionChanged: (selection) {
              ref.read(themeModeControllerProvider.notifier).setThemeMode(selection.first);
            },
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
    );
  }
}

/// Shows the Google account picture when available (only source of avatars
/// today — email/password accounts have none), falling back to a plain icon.
/// Network image failures (offline, revoked URL) fall back silently rather
/// than showing a broken-image glyph.
class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.avatarUrl});

  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    if (url == null || url.isEmpty) {
      return const CircleAvatar(child: Icon(Icons.person_rounded));
    }
    return CircleAvatar(
      backgroundImage: NetworkImage(url),
      onBackgroundImageError: (_, _) {},
      child: null,
    );
  }
}
