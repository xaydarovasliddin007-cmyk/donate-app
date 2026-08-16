class ReceivingMethod {
  const ReceivingMethod({
    required this.id,
    required this.cardNumberMasked,
    required this.cardHolderName,
    this.bankName,
  });

  final String id;
  final String cardNumberMasked;
  final String cardHolderName;
  final String? bankName;

  factory ReceivingMethod.fromJson(Map<String, dynamic> json) => ReceivingMethod(
    id: json['id'] as String,
    cardNumberMasked: json['cardNumberMasked'] as String,
    cardHolderName: json['cardHolderName'] as String,
    bankName: json['bankName'] as String?,
  );
}
