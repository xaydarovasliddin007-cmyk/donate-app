import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/notifications_providers.dart';
import '../domain/app_notification.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final resultAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.notificationsTitle),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationsApiProvider).markAllAsRead();
              ref.invalidate(notificationsProvider);
            },
            child: Text(l10n.notificationsMarkAllRead),
          ),
        ],
      ),
      body: SafeArea(
        child: resultAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: const [
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
              onRetry: () => ref.invalidate(notificationsProvider),
            );
          },
          data: (result) {
            if (result.notifications.isEmpty) {
              return EmptyView(title: l10n.notificationsEmpty);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: result.notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) =>
                  _NotificationTile(notification: result.notifications[index]),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});

  final AppNotification notification;

  IconData get _icon => switch (notification.type) {
    NotificationKind.orderSuccess => Icons.check_circle_outline_rounded,
    NotificationKind.orderFailed => Icons.error_outline_rounded,
    NotificationKind.paymentSuccess => Icons.credit_card_rounded,
    NotificationKind.topupSuccess => Icons.add_card_rounded,
    NotificationKind.refund => Icons.replay_rounded,
    NotificationKind.security => Icons.shield_outlined,
    NotificationKind.promotion => Icons.campaign_outlined,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.md),
      onTap: () async {
        if (notification.isUnread) {
          await ref.read(notificationsApiProvider).markAsRead(notification.id);
          ref.invalidate(notificationsProvider);
        }
        final link = notification.deepLink;
        if (link != null && context.mounted) context.push(link);
      },
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: notification.isUnread
              ? theme.colorScheme.primary.withValues(alpha: 0.06)
              : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_icon, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(notification.title, style: theme.textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(notification.body, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
            if (notification.isUnread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
