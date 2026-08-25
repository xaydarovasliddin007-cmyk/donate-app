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
    this.expiresAt,
  });

  final String id;
  final int amountMinor;
  final String currency;
  final TopUpRequestStatus status;
  final ReceivingMethod receivingMethod;
  final DateTime createdAt;
  final String? rejectionReason;

  /// Set only for card-transfer reservations created via [TopupApi.reserveTopUp]
  /// — after this, the assigned card is free for someone else to be given
  /// instead, whether or not this request ever got paid.
  final DateTime? expiresAt;

  factory TopUpRequest.fromJson(Map<String, dynamic> json) => TopUpRequest(
    id: json['id'] as String,
    amountMinor: json['amountMinor'] as int,
    currency: json['currency'] as String,
    status: _statusFromJson(json['status'] as String),
    receivingMethod: ReceivingMethod.fromJson(
      json['receivingMethod'] as Map<String, dynamic>,
    ),
    createdAt: DateTime.parse(json['createdAt'] as String),
    rejectionReason: json['rejectionReason'] as String?,
    expiresAt: json['expiresAt'] != null
        ? DateTime.parse(json['expiresAt'] as String)
        : null,
  );
}
