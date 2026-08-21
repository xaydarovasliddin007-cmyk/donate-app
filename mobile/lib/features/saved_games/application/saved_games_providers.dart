import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/saved_games_api.dart';
import '../domain/saved_game.dart';

final savedGamesApiProvider = Provider<SavedGamesApi>(
  (ref) => SavedGamesApi(ref.watch(apiClientProvider)),
);

/// Callers must only watch this when authenticated (see HomeScreen) — the
/// backend requires auth and there's nothing meaningful to show a guest.
final savedGamesListProvider = FutureProvider.autoDispose<List<SavedGame>>((
  ref,
) {
  return ref.watch(savedGamesApiProvider).list();
});
