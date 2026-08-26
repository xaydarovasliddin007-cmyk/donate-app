/// Result of a pre-checkout "does this player ID exist" check — advisory
/// only. A failed/absent check never blocks Continue; the real gate is the
/// same validation re-run server-side when the order is actually created.
class PlayerValidation {
  const PlayerValidation({
    required this.valid,
    this.playerName,
    this.reason,
  });

  final bool valid;
  final String? playerName;
  final String? reason;

  factory PlayerValidation.fromJson(Map<String, dynamic> json) =>
      PlayerValidation(
        valid: json['valid'] as bool,
        playerName: json['playerName'] as String?,
        reason: json['reason'] as String?,
      );
}
