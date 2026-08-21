import 'order_status.dart';

class OrderGameRef {
  const OrderGameRef({
    required this.id,
    required this.name,
    required this.slug,
  });

  final String id;
  final String name;
  final String slug;

  factory OrderGameRef.fromJson(Map<String, dynamic> json) => OrderGameRef(
    id: json['id'] as String,
    name: json['name'] as String,
    slug: json['slug'] as String,
  );
}

class OrderItemSummary {
  const OrderItemSummary({
    required this.productName,
    required this.quantity,
    required this.totalAmountMinor,
  });

  final String productName;
  final int quantity;
  final int totalAmountMinor;

  factory OrderItemSummary.fromJson(Map<String, dynamic> json) =>
      OrderItemSummary(
        productName: json['productName'] as String,
        quantity: json['quantity'] as int,
        totalAmountMinor: json['totalAmountMinor'] as int,
      );
}

class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.game,
    required this.playerId,
    this.serverId,
    required this.amountMinor,
    required this.currency,
    this.failureReason,
    required this.items,
    this.latestPaymentId,
    required this.createdAt,
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final OrderGameRef game;
  final String playerId;
  final String? serverId;
  final int amountMinor;
  final String currency;
  final String? failureReason;
  final List<OrderItemSummary> items;
  final String? latestPaymentId;
  final DateTime createdAt;

  factory Order.fromJson(Map<String, dynamic> json) {
    final latestPayment = json['latestPayment'] as Map<String, dynamic>?;
    return Order(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: orderStatusFromJson(json['status'] as String),
      game: OrderGameRef.fromJson(json['game'] as Map<String, dynamic>),
      playerId: json['playerId'] as String,
      serverId: json['serverId'] as String?,
      amountMinor: json['amountMinor'] as int,
      currency: json['currency'] as String,
      failureReason: json['failureReason'] as String?,
      items: (json['items'] as List<dynamic>)
          .map((i) => OrderItemSummary.fromJson(i as Map<String, dynamic>))
          .toList(),
      latestPaymentId: latestPayment?['id'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
