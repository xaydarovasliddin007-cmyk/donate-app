enum GameAvailability { active, comingSoon, disabled }

GameAvailability _parseAvailability(String value) => switch (value) {
  'ACTIVE' => GameAvailability.active,
  'DISABLED' => GameAvailability.disabled,
  _ => GameAvailability.comingSoon,
};

class Game {
  const Game({
    required this.id,
    required this.slug,
    required this.name,
    this.category,
    this.logoEmoji,
    this.logoUrl,
    required this.availability,
  });

  final String id;
  final String slug;
  final String name;
  final String? category;
  final String? logoEmoji;
  final String? logoUrl;
  final GameAvailability availability;

  bool get isPurchasable => availability == GameAvailability.active;

  factory Game.fromJson(Map<String, dynamic> json) => Game(
    id: json['id'] as String,
    slug: json['slug'] as String,
    name: json['name'] as String,
    category: json['category'] as String?,
    logoEmoji: json['logoEmoji'] as String?,
    logoUrl: json['logoUrl'] as String?,
    availability: _parseAvailability(json['availability'] as String),
  );
}
