import '../../../core/network/api_client.dart';
import '../domain/order.dart';
import '../domain/player_validation.dart';

class OrdersApi {
  OrdersApi(this._client);

  final ApiClient _client;

  Future<PlayerValidation> validatePlayer({
    required String gameId,
    required String productId,
    required String playerId,
    String? serverId,
  }) async {
    final json = await _client.post(
      '/orders/validate-player',
      body: {
        'gameId': gameId,
        'productId': productId,
        'playerId': playerId,
        if (serverId != null && serverId.isNotEmpty) 'serverId': serverId,
      },
    );
    return PlayerValidation.fromJson(json);
  }

  Future<Order> createOrder({
    required String gameId,
    required String productId,
    required String playerId,
    String? serverId,
    required String idempotencyKey,
  }) async {
    final json = await _client.post(
      '/orders',
      body: {
        'gameId': gameId,
        'productId': productId,
        'playerId': playerId,
        if (serverId != null && serverId.isNotEmpty) 'serverId': serverId,
        'idempotencyKey': idempotencyKey,
      },
    );
    return Order.fromJson(json);
  }

  Future<List<Order>> listOrders({int limit = 20}) async {
    final json = await _client.get('/orders', query: {'limit': limit});
    final orders = json['orders'] as List<dynamic>;
    return orders
        .map((o) => Order.fromJson(o as Map<String, dynamic>))
        .toList();
  }

  Future<Order> getOrder(String id) async {
    final json = await _client.get('/orders/$id');
    return Order.fromJson(json);
  }
}
