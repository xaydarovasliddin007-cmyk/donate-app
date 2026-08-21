class Wallet {
  const Wallet({required this.balanceMinor, required this.currency});

  final int balanceMinor;
  final String currency;

  factory Wallet.fromJson(Map<String, dynamic> json) => Wallet(
    balanceMinor: json['balanceMinor'] as int,
    currency: json['currency'] as String,
  );
}

enum WalletTransactionType { topup, purchase, refund, adjustment, bonus }

WalletTransactionType _typeFromJson(String value) => switch (value) {
  'TOPUP' => WalletTransactionType.topup,
  'PURCHASE' => WalletTransactionType.purchase,
  'REFUND' => WalletTransactionType.refund,
  'BONUS' => WalletTransactionType.bonus,
  _ => WalletTransactionType.adjustment,
};

enum WalletTransactionDirection { credit, debit }

class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.type,
    required this.direction,
    required this.amountMinor,
    required this.currency,
    required this.reference,
    required this.reason,
    required this.createdAt,
  });

  final String id;
  final WalletTransactionType type;
  final WalletTransactionDirection direction;
  final int amountMinor;
  final String currency;
  final String? reference;
  final String? reason;
  final DateTime createdAt;

  factory WalletTransaction.fromJson(Map<String, dynamic> json) =>
      WalletTransaction(
        id: json['id'] as String,
        type: _typeFromJson(json['type'] as String),
        direction: (json['direction'] as String) == 'CREDIT'
            ? WalletTransactionDirection.credit
            : WalletTransactionDirection.debit,
        amountMinor: json['amountMinor'] as int,
        currency: json['currency'] as String,
        reference: json['reference'] as String?,
        reason: json['reason'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
