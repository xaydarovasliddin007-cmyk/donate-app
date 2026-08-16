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

  static const Color darkBackground = Color(0xFF0B0D12);
  static const Color darkSurface = Color(0xFF171A21);
  static const Color darkOnSurface = Color(0xFFF3F4F6);

  static const List<Color> heroGradientLight = [brandPrimary, brandAccent];
  static const List<Color> heroGradientDark = [Color(0xFF2F52C4), Color(0xFF5A3FCC)];
}
