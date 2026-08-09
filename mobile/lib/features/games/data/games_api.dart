import '../../../core/network/api_client.dart';
import '../domain/game.dart';
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

  Future<List<Product>> listGameProducts(String gameId) async {
    final json = await _client.get('/games/$gameId/products');
    final products = json['products'] as List<dynamic>;
    return products.map((p) => Product.fromJson(p as Map<String, dynamic>)).toList();
  }
}
