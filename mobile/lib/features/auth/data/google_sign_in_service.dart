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
    try {
      await GoogleSignIn.instance.initialize(
        serverClientId: AppConfig.googleServerClientId,
      );
      _initialized = true;
    } catch (e) {
      // ignore: avoid_print
      print('GoogleSignInService: initialize() threw ${e.runtimeType}: $e');
      rethrow;
    }
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
        // ignore: avoid_print
        print('GoogleSignInService: succeeded but returned a null ID token');
        throw ApiException.googleSignInFailed();
      }
      return idToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return null;
      }
      // The plugin's exception code/description is the only thing that
      // actually explains *why* (e.g. DEVELOPER_ERROR vs a real network
      // failure) — Google Play Services doesn't surface that reason via
      // logcat on its own, so this is the only way to see it. Plain
      // print(), not dart:developer's log() — the latter needs an attached
      // VM service to go anywhere, which release builds don't have.
      // ignore: avoid_print
      print(
        'GoogleSignInService: failed code=${e.code} description=${e.description} details=${e.details}',
      );
      throw ApiException.googleSignInFailed(e);
    } catch (e) {
      // Anything that ISN'T a GoogleSignInException — e.g. a raw
      // PlatformException from the underlying Credential Manager API —
      // would otherwise propagate uncaught and get mapped to the exact
      // same generic "sign-in failed" message by the UI, indistinguishable
      // from the expected-path failure above. Log it before rethrowing so
      // it isn't silently indistinguishable from that path.
      // ignore: avoid_print
      print('GoogleSignInService: authenticate() threw ${e.runtimeType}: $e');
      rethrow;
    }
  }
}
