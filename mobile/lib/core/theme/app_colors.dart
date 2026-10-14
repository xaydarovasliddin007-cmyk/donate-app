import 'package:flutter/material.dart';

abstract final class AppColors {
  static const Color brandInk = Color(0xFF0A0D15);
  static const Color brandPrimary = Color(0xFF387BFF);
  // The deeper action color keeps small white button labels readable.
  static const Color brandAction = Color(0xFF2563DB);
  static const Color brandPrimaryDark = Color(0xFF8DB4FF);
  static const Color brandAccent = Color(0xFF46DCEF);
  static const Color brandAccentDark = Color(0xFF75E5F3);
  static const Color brandWarm = Color(0xFFFFB02E);

  static const Color success = Color(0xFF22A45D);
  static const Color warning = Color(0xFFE0A317);
  static const Color danger = Color(0xFFE0453C);

  static const Color lightBackground = Color(0xFFF5F8FF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightOnSurface = brandInk;

  static const Color darkBackground = brandInk;
  static const Color darkSurface = Color(0xFF121925);
  static const Color darkOnSurface = Color(0xFFF4F6FA);

  static const Color surfaceCardLight = Color(0xFFEDF2FA);
  static const Color surfaceCardDark = Color(0xFF1B2638);

  static const List<Color> heroGradientLight = [
    Color(0xFF10204B),
    Color(0xFF2458C6),
  ];
  static const List<Color> heroGradientDark = [
    Color(0xFF101A32),
    Color(0xFF1F4CA8),
  ];

  static const List<List<Color>> tileGradients = [
    [Color(0xFF234EA5), Color(0xFF3170E7)],
    [Color(0xFF186F91), Color(0xFF2458C6)],
    [Color(0xFF986116), Color(0xFFB24836)],
    [Color(0xFF6643B6), Color(0xFF9E3B7C)],
    [Color(0xFF237047), Color(0xFF1D7974)],
  ];
}
