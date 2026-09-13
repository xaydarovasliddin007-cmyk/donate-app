import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Auth tokens only. Everything else (theme, locale) is non-secret and lives
/// in [PreferencesService]/SharedPreferences — Keystore/Keychain-backed
/// storage is slower and unnecessary for those.
class SecureStorageService {
  SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'auth.access_token';
  static const _refreshTokenKey = 'auth.refresh_token';
  static const _deviceIdKey = 'auth.device_id';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<String> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final newId =
        'dev_${DateTime.now().millisecondsSinceEpoch}_${(100000 + (DateTime.now().microsecondsSinceEpoch % 900000))}';
    await _storage.write(key: _deviceIdKey, value: newId);
    return newId;
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
