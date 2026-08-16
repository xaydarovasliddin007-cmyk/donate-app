import 'receiving_method.dart';

enum TopUpRequestStatus { pending, verified, rejected, expired }

TopUpRequestStatus _statusFromJson(String value) => switch (value) {
  'VERIFIED' => TopUpRequestStatus.verified,
  'REJECTED' => TopUpRequestStatus.rejected,
  'EXPIRED' => TopUpRequestStatus.expired,
  _ => TopUpRequestStatus.pending,
};

class TopUpRequest {
  const TopUpRequest({
    required this.id,
    required this.amountMinor,
    required this.currency,
    required this.status,
    required this.receivingMethod,
    required this.createdAt,
    this.rejectionReason,
  });

  final String id;
  final int amountMinor;
  final String currency;
  final TopUpRequestStatus status;
  final ReceivingMethod receivingMethod;
  final DateTime createdAt;
  final String? rejectionReason;

  factory TopUpRequest.fromJson(Map<String, dynamic> json) => TopUpRequest(
    id: json['id'] as String,
    amountMinor: json['amountMinor'] as int,
    currency: json['currency'] as String,
    status: _statusFromJson(json['status'] as String),
    receivingMethod: ReceivingMethod.fromJson(json['receivingMethod'] as Map<String, dynamic>),
    createdAt: DateTime.parse(json['createdAt'] as String),
    rejectionReason: json['rejectionReason'] as String?,
  );
}
