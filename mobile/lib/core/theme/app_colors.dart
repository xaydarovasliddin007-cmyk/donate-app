import 'package:flutter/material.dart';

/// Brand color tokens. Screens should reference [Theme.of(context).colorScheme]
/// or these constants — never hardcode a `Color(0x...)` inline in a widget.
abstract final class AppColors {
  static const Color brandPrimary = Color(0xFF3B6FF6);
  static const Color brandPrimaryDark = Color(0xFF6E93FF);

  /// Secondary accent — used sparingly (hero gradient, badges, selected
  /// states) so it reads as a considered highlight, not decoration.
  static const Color brandAccent = Color(0xFF7C5CFC);
  static const Color brandAccentDark = Color(0xFF9B82FF);

  static const Color success = Color(0xFF22A45D);
  static const Color warning = Color(0xFFE0A317);
  static const Color danger = Color(0xFFE0453C);

  static const Color lightBackground = Color(0xFFF6F7FB);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightOnSurface = Color(0xFF14161A);

  // A deep navy, not near-black — pure black behind brand-blue content reads
  // as "empty app", not "premium dark theme". Keeping a visible (if subtle)
  // blue undertone here is what makes the whole dark theme feel considered
  // rather than just "the default with the lights off".
  static const Color darkBackground = Color(0xFF0C1122);
  static const Color darkSurface = Color(0xFF181F35);
  static const Color darkOnSurface = Color(0xFFF3F4F6);

  /// A touch lighter than [darkSurface]/[lightSurface] — for a card nested
  /// on top of another card (stat tiles, payment tiles) without leaning on
  /// Material's generated tonal surfaces for every layer.
  static const Color surfaceCardLight = Color(0xFFEFF1F8);
  static const Color surfaceCardDark = Color(0xFF1F2740);

  static const List<Color> heroGradientLight = [brandPrimary, brandAccent];
  static const List<Color> heroGradientDark = [
    Color(0xFF2F52C4),
    Color(0xFF5A3FCC),
  ];

  /// A small family of brand-derived gradients (cooler/warmer shifts of the
  /// same two hues, never gold) — cycled across payment-method / cover-art
  /// fallback tiles so a grid of them reads as one considered set rather
  /// than random colors.
  static const List<List<Color>> tileGradients = [
    [Color(0xFF3B6FF6), Color(0xFF7C5CFC)], // brand blue -> violet
    [Color(0xFF2E8FDB), Color(0xFF3B6FF6)], // teal-blue -> brand blue
    [Color(0xFF7C5CFC), Color(0xFFB25CE0)], // violet -> magenta
    [Color(0xFF4C63E0), Color(0xFF2E3E9E)], // indigo -> deep indigo
  ];
}
