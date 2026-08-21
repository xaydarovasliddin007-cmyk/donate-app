class Session {
  const Session({
    required this.id,
    required this.userAgent,
    required this.ipAddress,
    required this.createdAt,
  });

  final String id;
  final String? userAgent;
  final String? ipAddress;
  final DateTime createdAt;

  factory Session.fromJson(Map<String, dynamic> json) => Session(
    id: json['id'] as String,
    userAgent: json['userAgent'] as String?,
    ipAddress: json['ipAddress'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}
