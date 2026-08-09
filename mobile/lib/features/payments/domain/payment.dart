enum PaymentStatus { pending, succeeded, failed, cancelled }

PaymentStatus paymentStatusFromJson(String value) => switch (value) {
  'SUCCEEDED' => PaymentStatus.succeeded,
  'FAILED' => PaymentStatus.failed,
  'CANCELLED' => PaymentStatus.cancelled,
  _ => PaymentStatus.pending,
};

class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.amountMinor,
    required this.currency,
    required this.status,
    required this.devSimulateAvailable,
  });

  final String id;
  final String orderId;
  final int amountMinor;
  final String currency;
  final PaymentStatus status;
  final bool devSimulateAvailable;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
    id: json['id'] as String,
    orderId: json['orderId'] as String,
    amountMinor: json['amountMinor'] as int,
    currency: json['currency'] as String,
    status: paymentStatusFromJson(json['status'] as String),
    devSimulateAvailable: json['devSimulateAvailable'] as bool? ?? false,
  );
}
