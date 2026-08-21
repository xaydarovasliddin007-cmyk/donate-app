import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/orders_api.dart';
import '../domain/order.dart';

final ordersApiProvider = Provider<OrdersApi>(
  (ref) => OrdersApi(ref.watch(apiClientProvider)),
);

final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) {
  return ref.watch(ordersApiProvider).listOrders();
});

final orderByIdProvider = FutureProvider.autoDispose.family<Order, String>((
  ref,
  orderId,
) {
  return ref.watch(ordersApiProvider).getOrder(orderId);
});
