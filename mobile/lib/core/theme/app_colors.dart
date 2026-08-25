import 'package:flutter/material.dart';

abstract final class AppColors {
  static const Color brandPrimary = Color(0xFF146CFF);
  static const Color brandPrimaryDark = Color(0xFF78A6FF);
  static const Color brandAccent = Color(0xFF00BFA6);
  static const Color brandAccentDark = Color(0xFF42E0CA);
  static const Color brandWarm = Color(0xFFFFB02E);

  static const Color success = Color(0xFF22A45D);
  static const Color warning = Color(0xFFE0A317);
  static const Color danger = Color(0xFFE0453C);

  static const Color lightBackground = Color(0xFFF7F9FD);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightOnSurface = Color(0xFF14161A);

  static const Color darkBackground = Color(0xFF101116);
  static const Color darkSurface = Color(0xFF181A22);
  static const Color darkOnSurface = Color(0xFFF4F6FA);

  static const Color surfaceCardLight = Color(0xFFEEF3F9);
  static const Color surfaceCardDark = Color(0xFF222431);

  static const List<Color> heroGradientLight = [brandPrimary, brandAccent];
  static const List<Color> heroGradientDark = [
    Color(0xFF1D65F2),
    Color(0xFF14B8A6),
  ];

  static const List<List<Color>> tileGradients = [
    [brandPrimary, brandAccent],
    [Color(0xFF19A7CE), Color(0xFF146CFF)],
    [Color(0xFFFFB02E), Color(0xFFFF6B6B)],
    [Color(0xFF8E5CF6), Color(0xFFFF4FA3)],
    [Color(0xFF22A45D), Color(0xFF00BFA6)],
  ];
}
