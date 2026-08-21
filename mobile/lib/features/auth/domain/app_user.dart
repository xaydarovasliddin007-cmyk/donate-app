class AppUser {
  const AppUser({
    required this.id,
    required this.publicId,
    this.email,
    this.phone,
    this.displayName,
    this.avatarUrl,
    required this.locale,
    required this.role,
    required this.hasGoogleAccount,
    required this.isEmailVerified,
  });

  final String id;

  /// Permanent, user-facing "UZD-XXXXXXXX" identity — safe to show/copy, never the internal [id].
  final String publicId;
  final String? email;
  final String? phone;
  final String? displayName;
  final String? avatarUrl;
  final String locale;
  final String role;
  final bool hasGoogleAccount;
  final bool isEmailVerified;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    publicId: json['publicId'] as String,
    email: json['email'] as String?,
    phone: json['phone'] as String?,
    displayName: json['displayName'] as String?,
    avatarUrl: json['avatarUrl'] as String?,
    locale: json['locale'] as String,
    role: json['role'] as String,
    hasGoogleAccount: json['hasGoogleAccount'] as bool? ?? false,
    isEmailVerified: json['isEmailVerified'] as bool? ?? false,
  );
}
