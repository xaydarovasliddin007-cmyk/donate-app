import 'dart:math';

/// A client-generated key that stays the same across retries of the *same*
/// user action (e.g. re-tapping "Buy now" after a timeout) so the backend
/// can safely dedupe. Generate once per checkout attempt, not per request.
String generateIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-$hex';
}
