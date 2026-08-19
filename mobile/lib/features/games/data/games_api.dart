import '../../../core/network/api_client.dart';
import '../domain/game.dart';
import '../domain/game_server.dart';
import '../domain/product.dart';

class GamesApi {
  GamesApi(this._client);

  final ApiClient _client;

  Future<List<Game>> listGames() async {
    final json = await _client.get('/games');
    final games = json['games'] as List<dynamic>;
    return games.map((g) => Game.fromJson(g as Map<String, dynamic>)).toList();
  }

  Future<Game> getGame(String id) async {
    final json = await _client.get('/games/$id');
    return Game.fromJson(json);
  }

  /// Empty for games with no server catalog — [listGameServers] returning an
  /// empty list is how the UI knows to skip the server-picker step.
  Future<List<GameServer>> listGameServers(String gameId) async {
    final json = await _client.get('/games/$gameId/servers');
    final servers = json['servers'] as List<dynamic>;
    return servers.map((s) => GameServer.fromJson(s as Map<String, dynamic>)).toList();
  }

  /// [serverCode] is required (and validated server-side) for games with a
  /// server catalog — omitting it there returns an empty list rather than an
  /// error, matching /orders' own resolution so what's shown and what's
  /// buyable never disagree.
  Future<List<Product>> listGameProducts(String gameId, {String? serverCode}) async {
    final json = await _client.get(
      '/games/$gameId/products',
      query: serverCode != null ? {'serverId': serverCode} : null,
    );
    final products = json['products'] as List<dynamic>;
    return products.map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
  }
}
