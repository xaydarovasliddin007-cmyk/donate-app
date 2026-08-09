import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/games_api.dart';
import '../domain/game.dart';
import '../domain/product.dart';

final gamesApiProvider = Provider<GamesApi>((ref) => GamesApi(ref.watch(apiClientProvider)));

final gamesListProvider = FutureProvider<List<Game>>((ref) {
  return ref.watch(gamesApiProvider).listGames();
});

final gameByIdProvider = FutureProvider.family<Game, String>((ref, gameId) {
  return ref.watch(gamesApiProvider).getGame(gameId);
});

final gameProductsProvider = FutureProvider.family<List<Product>, String>((ref, gameId) {
  return ref.watch(gamesApiProvider).listGameProducts(gameId);
});
