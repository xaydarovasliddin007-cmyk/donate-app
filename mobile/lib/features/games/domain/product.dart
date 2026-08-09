class Product {
  const Product({
    required this.id,
    required this.name,
    this.description,
    required this.amountMinor,
    required this.currency,
    required this.isTest,
  });

  final String id;
  final String name;
  final String? description;
  final int amountMinor;
  final String currency;
  final bool isTest;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'] as String,
    name: json['name'] as String,
    description: json['description'] as String?,
    amountMinor: json['amountMinor'] as int,
    currency: json['currency'] as String,
    isTest: json['isTest'] as bool? ?? false,
  );
}
