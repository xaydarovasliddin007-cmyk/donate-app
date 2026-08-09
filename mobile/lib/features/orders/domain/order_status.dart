enum OrderStatus { pending, paid, processing, completed, failed, cancelled, refunded }

OrderStatus orderStatusFromJson(String value) => switch (value) {
  'PENDING' => OrderStatus.pending,
  'PAID' => OrderStatus.paid,
  'PROCESSING' => OrderStatus.processing,
  'COMPLETED' => OrderStatus.completed,
  'FAILED' => OrderStatus.failed,
  'CANCELLED' => OrderStatus.cancelled,
  'REFUNDED' => OrderStatus.refunded,
  _ => OrderStatus.pending,
};

/// True for statuses where the order is done changing on its own — no more
/// polling needed.
bool isTerminalOrderStatus(OrderStatus status) =>
    status == OrderStatus.completed ||
    status == OrderStatus.failed ||
    status == OrderStatus.cancelled ||
    status == OrderStatus.refunded;
