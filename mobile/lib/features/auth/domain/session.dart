class Session {
  const Session({
    required this.id,
    required this.userAgent,
    required this.ipAddress,
    required this.createdAt,
    required this.isCurrent,
  });

  final String id;
  final String? userAgent;
  final String? ipAddress;
  final DateTime createdAt;

  /// True for the one session backing the access token making this very
  /// request — lets the security center point out "this is the device
  /// you're looking at right now" instead of an undifferentiated list.
  final bool isCurrent;

  factory Session.fromJson(Map<String, dynamic> json) => Session(
    id: json['id'] as String,
    userAgent: json['userAgent'] as String?,
    ipAddress: json['ipAddress'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
    isCurrent: json['isCurrent'] as bool? ?? false,
  );
}
