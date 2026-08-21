import 'package:flutter/material.dart';

enum PlayerIdFieldType { numericId, tag, username }

/// What the Player Info screen should ask for, per game — real top-up
/// providers (Codashop, UniPin) ask for very different things depending on
/// the game: Mobile Legends and Genshin Impact need a UID *and* a server/
/// region (handled separately, via each game's real [GameServer] catalog),
/// while everything else here needs exactly one identifier and nothing
/// else — asking those games for a "Server ID" too was never correct, it
/// was just the same generic field shown for every game regardless of
/// whether that game has a server concept at all.
class PlayerIdFieldSpec {
  const PlayerIdFieldSpec({required this.type, required this.icon});

  final PlayerIdFieldType type;
  final IconData icon;

  static const _numericId = PlayerIdFieldSpec(
    type: PlayerIdFieldType.numericId,
    icon: Icons.badge_outlined,
  );
  static const _tag = PlayerIdFieldSpec(
    type: PlayerIdFieldType.tag,
    icon: Icons.sell_outlined,
  );
  static const _username = PlayerIdFieldSpec(
    type: PlayerIdFieldType.username,
    icon: Icons.alternate_email_rounded,
  );

  /// Supercell titles identify players by a "#"-prefixed tag, not a numeric
  /// UID — everything else here (including Mobile Legends/Genshin, whose
  /// *server* is handled separately) uses a plain numeric player ID.
  static const _tagGameSlugs = {
    'clash-of-clans',
    'clash-royale',
    'brawl-stars',
  };

  /// Platform-account-name based, not a game-issued numeric ID.
  static const _usernameGameSlugs = {'roblox'};

  static PlayerIdFieldSpec forGameSlug(String slug) {
    if (_tagGameSlugs.contains(slug)) return _tag;
    if (_usernameGameSlugs.contains(slug)) return _username;
    return _numericId;
  }
}
