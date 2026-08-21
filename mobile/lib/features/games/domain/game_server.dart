/// A game's regional/version server — only present for games where pricing
/// (or fulfillment) actually differs by server, e.g. Mobile Legends. Games
/// without any [GameServer]s skip the server-picker step entirely.
class GameServer {
  const GameServer({required this.id, required this.name, required this.code});

  final String id;
  final String name;
  final String code;

  factory GameServer.fromJson(Map<String, dynamic> json) => GameServer(
    id: json['id'] as String,
    name: json['name'] as String,
    code: json['code'] as String,
  );
}
