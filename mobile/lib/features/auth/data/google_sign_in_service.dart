import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_exception.dart';

/// Thin wrapper around the google_sign_in plugin's singleton API: handles
/// one-time initialization and surfaces a plain ID token (or null if the
/// user cancelled) so the rest of the app never touches the plugin's
/// exception/event-stream API directly.
class GoogleSignInService {
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await GoogleSignIn.instance.initialize(serverClientId: AppConfig.googleServerClientId);
    _initialized = true;
  }

  /// Returns the Google ID token for a freshly authenticated user, or null
  /// if the user cancelled the account picker. Throws [ApiException] with
  /// code `GOOGLE_SIGN_IN_FAILED` for any other failure.
  Future<String?> signIn() async {
    await _ensureInitialized();
    try {
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw ApiException.googleSignInFailed();
      }
      return idToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return null;
      }
      throw ApiException.googleSignInFailed(e);
    }
  }
}
