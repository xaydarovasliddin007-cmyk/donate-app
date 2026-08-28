enum ReceivingMethodType { cardTransfer, qrCode, paynetTerminal }

ReceivingMethodType _typeFromJson(String value) => switch (value) {
  'QR_CODE' => ReceivingMethodType.qrCode,
  'PAYNET_TERMINAL' => ReceivingMethodType.paynetTerminal,
  _ => ReceivingMethodType.cardTransfer,
};

String receivingMethodTypeToJson(ReceivingMethodType type) => switch (type) {
  ReceivingMethodType.cardTransfer => 'CARD_TRANSFER',
  ReceivingMethodType.qrCode => 'QR_CODE',
  ReceivingMethodType.paynetTerminal => 'PAYNET_TERMINAL',
};

class ReceivingMethod {
  const ReceivingMethod({
    required this.id,
    required this.type,
    this.cardNumber,
    required this.cardHolderName,
    this.bankName,
    this.qrPayload,
  });

  final String id;
  final ReceivingMethodType type;

  /// Only set for [ReceivingMethodType.cardTransfer].
  final String? cardNumber;

  /// For card-transfer this is the cardholder's name; for the QR/terminal
  /// types it's just the display label (e.g. "Paynet QR").
  final String cardHolderName;
  final String? bankName;

  /// The raw QR payload/link, rendered as an actual QR image — only set
  /// for [ReceivingMethodType.qrCode] and [ReceivingMethodType.paynetTerminal].
  final String? qrPayload;

  factory ReceivingMethod.fromJson(Map<String, dynamic> json) =>
      ReceivingMethod(
        id: json['id'] as String,
        type: _typeFromJson(json['type'] as String? ?? 'CARD_TRANSFER'),
        cardNumber: json['cardNumber'] as String?,
        cardHolderName: json['cardHolderName'] as String,
        bankName: json['bankName'] as String?,
        qrPayload: json['qrPayload'] as String?,
      );
}
