import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/games_api.dart';
import '../domain/game.dart';
import '../domain/game_server.dart';
import '../domain/product.dart';

final gamesApiProvider = Provider<GamesApi>((ref) => GamesApi(ref.watch(apiClientProvider)));

final gamesListProvider = FutureProvider<List<Game>>((ref) {
  return ref.watch(gamesApiProvider).listGames();
});

final gameByIdProvider = FutureProvider.family<Game, String>((ref, gameId) {
  return ref.watch(gamesApiProvider).getGame(gameId);
});

/// Empty for games with no server catalog — screens use that to skip the
/// server-picker step entirely rather than showing an empty selector.
final gameServersProvider = FutureProvider.family<List<GameServer>, String>((ref, gameId) {
  return ref.watch(gamesApiProvider).listGameServers(gameId);
});

/// `(gameId, serverCode)` — serverCode is null for games without servers.
typedef GameProductsQuery = ({String gameId, String? serverCode});

final gameProductsProvider = FutureProvider.family<List<Product>, GameProductsQuery>((ref, query) {
  return ref.watch(gamesApiProvider).listGameProducts(query.gameId, serverCode: query.serverCode);
});
