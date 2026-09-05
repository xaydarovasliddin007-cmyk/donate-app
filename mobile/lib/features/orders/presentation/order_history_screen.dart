import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/selectable_chip.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../auth/application/auth_controller.dart';
import '../application/orders_providers.dart';
import '../domain/order.dart';
import '../domain/order_status.dart';
import 'widgets/order_card.dart';

/// Only orders where money was actually captured count as "spent" — pending
/// (not yet paid) never captured anything, and failed/cancelled/refunded
/// never kept it, so none of those should inflate the total.
int _totalSpentMinor(List<Order> orders) => orders
    .where(
      (o) => switch (o.status) {
        OrderStatus.paid || OrderStatus.processing || OrderStatus.completed =>
          true,
        _ => false,
      },
    )
    .fold(0, (sum, o) => sum + o.amountMinor);

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

                    // CustomScrollView + SliverList.builder here (not a plain
                    // ListView with a `for` loop building every OrderCard up
                    // front) — the eager version rebuilt and replayed every
                    // card's StaggeredEntrance timer on each filter-chip tap,
                    // and only got worse as order history grew. This lazily
                    // builds just the visible cards, matching the pattern
                    // wallet_history_screen.dart/notifications_screen.dart
                    // already use.
                    return RefreshIndicator(
                      onRefresh: () async => ref.invalidate(myOrdersProvider),
                      child: CustomScrollView(
                        slivers: [
                          SliverPadding(
                            padding: const EdgeInsets.only(top: AppSpacing.md),
                            sliver: SliverToBoxAdapter(
                              child: Column(
                                children: [
                                  _SummaryHeader(orders: orders),
                                  const SizedBox(height: AppSpacing.md),
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
                                                _OrderFilter.all =>
                                                  l10n.orderFilterAll,
                                                _OrderFilter.pending =>
                                                  l10n.orderFilterPending,
                                                _OrderFilter.completed =>
                                                  l10n.orderFilterCompleted,
                                                _OrderFilter.failed =>
                                                  l10n.orderFilterFailed,
                                              },
                                              selected: _filter == f,
                                              onTap: () =>
                                                  setState(() => _filter = f),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.md),
                                ],
                              ),
                            ),
                          ),
                          if (filtered.isEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.lg,
                                  vertical: AppSpacing.xl,
                                ),
                                child: EmptyView(
                                  icon: Icons.filter_alt_off_outlined,
                                  title: l10n.orderHistoryEmptyFilteredTitle,
                                ),
                              ),
                            )
                          else
                            SliverPadding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                              ),
                              sliver: SliverList.separated(
                                itemCount: filtered.length,
                                separatorBuilder: (context, index) =>
                                    const SizedBox(height: AppSpacing.sm),
                                itemBuilder: (context, index) {
                                  final order = filtered[index];
                                  return StaggeredEntrance(
                                    index: index,
                                    child: OrderCard(
                                      order: order,
                                      onTap: () =>
                                          context.push('/orders/${order.id}'),
                                    ),
                                  );
                                },
                              ),
                            ),
                          const SliverToBoxAdapter(
                            child: SizedBox(height: AppSpacing.lg),
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

/// A gradient glance strip — order count and total spent — above the filter
/// chips, matching the stat-chip treatment already used on the profile
/// header. Reflects the full order list regardless of the active filter, so
/// switching filters never makes these numbers jump around.
class _SummaryHeader extends StatelessWidget {
  const _SummaryHeader({required this.orders});

  final List<Order> orders;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;
    final localeName = Localizations.localeOf(context).toString();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: gradient.first.withValues(alpha: isDark ? 0.35 : 0.25),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: _SummaryStat(
                icon: Icons.receipt_long_rounded,
                label: l10n.profileStatOrders,
                value: '${orders.length}',
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Container(
              width: 1,
              height: 32,
              color: Colors.white.withValues(alpha: 0.2),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _SummaryStat(
                icon: Icons.bolt_rounded,
                label: l10n.orderHistoryStatSpent,
                value: formatMoney(
                  _totalSpentMinor(orders),
                  orders.first.currency,
                  localeName,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: Colors.white70),
            const SizedBox(width: 4),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: Colors.white70,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: theme.textTheme.titleSmall?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
