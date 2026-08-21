class Promotion {
  const Promotion({
    required this.id,
    required this.code,
    required this.title,
    this.description,
  });

  final String id;
  final String code;
  final String title;
  final String? description;

  factory Promotion.fromJson(Map<String, dynamic> json) => Promotion(
    id: json['id'] as String,
    code: json['code'] as String,
    title: json['title'] as String,
    description: json['description'] as String?,
  );
}
