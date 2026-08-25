class ReceivingMethod {
  const ReceivingMethod({
    required this.id,
    required this.cardNumber,
    required this.cardHolderName,
    this.bankName,
  });

  final String id;
  final String cardNumber;
  final String cardHolderName;
  final String? bankName;

  factory ReceivingMethod.fromJson(Map<String, dynamic> json) =>
      ReceivingMethod(
        id: json['id'] as String,
        cardNumber: json['cardNumber'] as String,
        cardHolderName: json['cardHolderName'] as String,
        bankName: json['bankName'] as String?,
      );
}
