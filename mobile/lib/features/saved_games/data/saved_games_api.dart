import '../../../core/network/api_client.dart';
import '../domain/saved_game.dart';

class SavedGamesApi {
  SavedGamesApi(this._client);

  final ApiClient _client;

  Future<List<SavedGame>> list() async {
    final json = await _client.get('/saved-games');
    final savedGames = json['savedGames'] as List<dynamic>;
    return savedGames.map((s) => SavedGame.fromJson(s as Map<String, dynamic>)).toList();
  }

  Future<SavedGame> upsert({required String gameId, required String playerId, String? serverId}) async {
    final json = await _client.put(
      '/saved-games/$gameId',
      body: {'playerId': playerId, 'serverId': ?serverId},
    );
    return SavedGame.fromJson(json);
  }

  Future<void> delete(String gameId) => _client.delete('/saved-games/$gameId');
}
