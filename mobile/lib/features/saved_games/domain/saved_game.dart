import '../../games/domain/game.dart';

/// A saved Player ID/Server ID for one game — "My Games" on the home
/// screen, enabling one-tap Quick Buy on the next purchase.
class SavedGame {
  const SavedGame({
    required this.id,
    required this.game,
    required this.playerId,
    this.serverId,
    required this.updatedAt,
  });

  final String id;
  final Game game;
  final String playerId;
  final String? serverId;
  final DateTime updatedAt;

  factory SavedGame.fromJson(Map<String, dynamic> json) => SavedGame(
    id: json['id'] as String,
    game: Game.fromJson(json['game'] as Map<String, dynamic>),
    playerId: json['playerId'] as String,
    serverId: json['serverId'] as String?,
    updatedAt: DateTime.parse(json['updatedAt'] as String),
  );
}
