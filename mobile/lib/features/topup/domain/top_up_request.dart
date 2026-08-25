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
    this.receivingMethod,
    this.receivingMethods,
    required this.createdAt,
    this.rejectionReason,
    this.expiresAt,
  });

  final String id;
  final int amountMinor;
  final String currency;
  final TopUpRequestStatus status;

  /// The specific card a matching bank transaction (or a manual admin
  /// review) identified as the one that actually received the transfer —
  /// null until then, since the reservation flow doesn't lock the user to
  /// one card up front (see [receivingMethods]).
  final ReceivingMethod? receivingMethod;

  /// Every card the user can transfer to. Present on the reservation
  /// flow's create/poll responses (re-sent on every poll so the UI doesn't
  /// lose the list after the first refresh) — null for the older
  /// pick-one-method-up-front flow, which doesn't need it.
  final List<ReceivingMethod>? receivingMethods;

  final DateTime createdAt;
  final String? rejectionReason;

  /// Set only for card-transfer reservations created via [TopupApi.reserveTopUp]
  /// — after this, the amount is free for someone else to be given
  /// instead, whether or not this request ever got paid.
  final DateTime? expiresAt;

  factory TopUpRequest.fromJson(Map<String, dynamic> json) => TopUpRequest(
    id: json['id'] as String,
    amountMinor: json['amountMinor'] as int,
    currency: json['currency'] as String,
    status: _statusFromJson(json['status'] as String),
    receivingMethod: json['receivingMethod'] != null
        ? ReceivingMethod.fromJson(
            json['receivingMethod'] as Map<String, dynamic>,
          )
        : null,
    receivingMethods: json['receivingMethods'] != null
        ? (json['receivingMethods'] as List<dynamic>)
              .map((m) => ReceivingMethod.fromJson(m as Map<String, dynamic>))
              .toList()
        : null,
    createdAt: DateTime.parse(json['createdAt'] as String),
    rejectionReason: json['rejectionReason'] as String?,
    expiresAt: json['expiresAt'] != null
        ? DateTime.parse(json['expiresAt'] as String)
        : null,
  );
}
