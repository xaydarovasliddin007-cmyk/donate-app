import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/selectable_chip.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../application/orders_providers.dart';
import '../domain/order_status.dart';
import 'widgets/order_card.dart';

/// Buckets the seven raw statuses into what a user actually scans a list
/// for — mid-flight, done, or went wrong — rather than one filter chip per
/// enum value, which would be seven near-identical tiny chips.
enum _OrderFilter { all, pending, completed, failed }

bool _matchesFilter(OrderStatus status, _OrderFilter filter) =>
    switch (filter) {
      _OrderFilter.all => true,
      _OrderFilter.pending =>
        status == OrderStatus.pending ||
            status == OrderStatus.paid ||
            status == OrderStatus.processing,
      _OrderFilter.completed => status == OrderStatus.completed,
      _OrderFilter.failed =>
        status == OrderStatus.failed ||
            status == OrderStatus.cancelled ||
            status == OrderStatus.refunded,
    };

class OrderHistoryScreen extends ConsumerStatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  ConsumerState<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends ConsumerState<OrderHistoryScreen> {
  _OrderFilter _filter = _OrderFilter.all;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isAuthenticated =
        ref.watch(authControllerProvider).value?.isAuthenticated ?? false;

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
                    final filtered = _filter == _OrderFilter.all
                        ? orders
                        : orders
                              .where((o) => _matchesFilter(o.status, _filter))
                              .toList();

                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(myOrdersProvider),
                      child: ListView(
                        padding: const EdgeInsets.only(
                          top: AppSpacing.md,
                          bottom: AppSpacing.lg,
                        ),
                        children: [
                          SizedBox(
                            height: 40,
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                              ),
                              children: [
                                for (final f in _OrderFilter.values)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      right: AppSpacing.sm,
                                    ),
                                    child: SelectableChip(
                                      label: switch (f) {
                                        _OrderFilter.all => l10n.orderFilterAll,
                                        _OrderFilter.pending =>
                                          l10n.orderFilterPending,
                                        _OrderFilter.completed =>
                                          l10n.orderFilterCompleted,
                                        _OrderFilter.failed =>
                                          l10n.orderFilterFailed,
                                      },
                                      selected: _filter == f,
                                      onTap: () => setState(() => _filter = f),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          if (filtered.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                                vertical: AppSpacing.xl,
                              ),
                              child: EmptyView(
                                icon: Icons.filter_alt_off_outlined,
                                title: l10n.orderHistoryEmptyFilteredTitle,
                              ),
                            )
                          else
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                              ),
                              child: Column(
                                children: [
                                  for (final (index, order) in filtered.indexed)
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: AppSpacing.sm,
                                      ),
                                      child: StaggeredEntrance(
                                        index: index,
                                        child: OrderCard(
                                          order: order,
                                          onTap: () => context.push(
                                            '/orders/${order.id}',
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}
