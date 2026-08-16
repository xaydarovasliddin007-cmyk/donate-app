import '../../../core/network/api_client.dart';
import '../domain/app_user.dart';
import '../domain/session.dart';

class AuthResult {
  const AuthResult({required this.user, required this.accessToken, required this.refreshToken});

  final AppUser user;
  final String accessToken;
  final String refreshToken;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
    user: AppUser.fromJson(json['user'] as Map<String, dynamic>),
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
  );
}

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<AuthResult> register({
    String? email,
    String? phone,
    required String password,
    String? displayName,
    required String locale,
  }) async {
    final json = await _client.post(
      '/auth/register',
      body: {
        'email': ?email,
        'phone': ?phone,
        'password': password,
        'displayName': ?displayName,
        'locale': locale,
      },
    );
    return AuthResult.fromJson(json);
  }

  Future<AuthResult> login({String? email, String? phone, required String password}) async {
    final json = await _client.post(
      '/auth/login',
      body: {
        'email': ?email,
        'phone': ?phone,
        'password': password,
      },
    );
    return AuthResult.fromJson(json);
  }

  Future<AuthResult> googleAuth({required String idToken, required String locale}) async {
    final json = await _client.post(
      '/auth/google',
      body: {'idToken': idToken, 'locale': locale},
    );
    return AuthResult.fromJson(json);
  }

  Future<void> logout(String refreshToken) =>
      _client.post('/auth/logout', body: {'refreshToken': refreshToken});

  Future<AppUser> me() async {
    final json = await _client.get('/auth/me');
    return AppUser.fromJson(json);
  }

  Future<List<Session>> listSessions() async {
    final json = await _client.get('/auth/sessions');
    final sessions = json['sessions'] as List<dynamic>;
    return sessions.map((s) => Session.fromJson(s as Map<String, dynamic>)).toList();
  }

  Future<void> revokeSession(String sessionId) => _client.delete('/auth/sessions/$sessionId');

  Future<void> logoutAllDevices() => _client.post('/auth/logout-all');

  Future<void> requestAccountDeletion() => _client.post('/auth/account/delete-request');
}
