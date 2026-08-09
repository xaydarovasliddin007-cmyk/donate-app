class AppUser {
  const AppUser({
    required this.id,
    this.email,
    this.phone,
    this.displayName,
    required this.locale,
    required this.role,
  });

  final String id;
  final String? email;
  final String? phone;
  final String? displayName;
  final String locale;
  final String role;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    email: json['email'] as String?,
    phone: json['phone'] as String?,
    displayName: json['displayName'] as String?,
    locale: json['locale'] as String,
    role: json['role'] as String,
  );
}
