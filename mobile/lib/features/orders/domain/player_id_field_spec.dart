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
  const PlayerIdFieldSpec({
    required this.type,
    required this.icon,
    this.requiresZoneId = false,
  });

  final PlayerIdFieldType type;
  final IconData icon;

  /// True for games whose real top-up provider needs a second numeric
  /// identifier alongside the player ID — e.g. Mobile Legends' Zone ID
  /// (Codashop/UniPin-style "User ID (Zone ID)"). This is distinct from the
  /// pricing-region [GameServer] picked earlier on the game's own page:
  /// that decides which price applies, this decides *whose* account it is.
  final bool requiresZoneId;

  static const _numericId = PlayerIdFieldSpec(
    type: PlayerIdFieldType.numericId,
    icon: Icons.badge_outlined,
  );
  static const _numericIdWithZone = PlayerIdFieldSpec(
    type: PlayerIdFieldType.numericId,
    icon: Icons.badge_outlined,
    requiresZoneId: true,
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
  /// UID — everything else here uses a plain numeric player ID.
  static const _tagGameSlugs = {
    'clash-of-clans',
    'clash-royale',
    'brawl-stars',
  };

  /// Platform-account-name based, not a game-issued numeric ID.
  static const _usernameGameSlugs = {'roblox'};

  /// Games whose real fulfillment provider needs a Zone ID, not just a user
  /// ID. Genshin Impact is deliberately excluded here — its four official
  /// regions are already the [GameServer] picked before checkout, so it has
  /// no separate numeric zone concept the way Mobile Legends does.
  static const _zoneIdGameSlugs = {'mobile-legends'};

  static PlayerIdFieldSpec forGameSlug(String slug) {
    if (_tagGameSlugs.contains(slug)) return _tag;
    if (_usernameGameSlugs.contains(slug)) return _username;
    if (_zoneIdGameSlugs.contains(slug)) return _numericIdWithZone;
    return _numericId;
  }
}
