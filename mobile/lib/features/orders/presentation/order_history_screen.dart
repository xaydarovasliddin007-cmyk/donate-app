import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../application/orders_providers.dart';
import 'widgets/order_status_badge.dart';

class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isAuthenticated = ref.watch(authControllerProvider).value?.isAuthenticated ?? false;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.orderHistoryTitle)),
      body: !isAuthenticated
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.authLoginRequiredMessage,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    FilledButton(
                      onPressed: () => context.push('/login'),
                      child: Text(l10n.authLoginButton),
                    ),
                  ],
                ),
              ),
            )
          : Consumer(
              builder: (context, ref, _) {
                final ordersAsync = ref.watch(myOrdersProvider);
                return ordersAsync.when(
                  loading: () => const LoadingView(),
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
                      onRetry: () => ref.invalidate(myOrdersProvider),
                    );
                  },
                  data: (orders) {
                    if (orders.isEmpty) {
                      return EmptyView(
                        icon: Icons.receipt_long_outlined,
                        title: l10n.orderHistoryEmptyTitle,
                        message: l10n.orderHistoryEmptyMessage,
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(myOrdersProvider),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: orders.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, index) {
                          final order = orders[index];
                          return Card(
                            child: ListTile(
                              title: Text('${order.game.name} · ${order.items.first.productName}'),
                              subtitle: Text(
                                '${order.orderNumber}\n${DateFormat.yMd().add_Hm().format(order.createdAt.toLocal())}',
                              ),
                              isThreeLine: true,
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  OrderStatusBadge(status: order.status),
                                  const SizedBox(height: 4),
                                  Text(
                                    formatMoney(
                                      order.amountMinor,
                                      order.currency,
                                      Localizations.localeOf(context).toString(),
                                    ),
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                              onTap: () => context.push('/orders/${order.id}'),
                            ),
                          );
                        },
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}
