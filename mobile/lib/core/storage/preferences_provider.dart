import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'preferences_service.dart';

/// Overridden in `main()` with a real instance once SharedPreferences has
/// loaded, before the first frame — see [main.dart]. Reading it before that
/// override is applied is a programming error.
final preferencesServiceProvider = Provider<PreferencesService>((ref) {
  throw UnimplementedError(
    'preferencesServiceProvider was not overridden before runApp()',
  );
});
