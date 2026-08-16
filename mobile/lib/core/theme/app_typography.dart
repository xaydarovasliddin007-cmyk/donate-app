import 'package:flutter/material.dart';

/// A deliberately tighter, heavier type scale than Flutter's Material
/// defaults — negative letter-spacing on headlines and higher font weights
/// read as "designed" rather than "default Roboto". No custom font file or
/// network font fetch is used (zero startup/offline cost) — this starts
/// from Flutter's own color-correct base TextTheme for the given
/// [ColorScheme] and only overrides weight/spacing/line-height, so dark
/// mode contrast stays exactly right.
abstract final class AppTypography {
  static TextTheme build(ColorScheme colorScheme) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: colorScheme.brightness,
      colorScheme: colorScheme,
    ).textTheme;

    return base.copyWith(
      displayLarge: base.displayLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1.2, height: 1.05),
      displayMedium: base.displayMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.8, height: 1.08),
      displaySmall: base.displaySmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
      headlineLarge: base.headlineLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5, height: 1.15),
      headlineMedium: base.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4, height: 1.18),
      headlineSmall: base.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
      titleLarge: base.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
      titleMedium: base.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.1),
      titleSmall: base.titleSmall?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.05),
      bodyLarge: base.bodyLarge?.copyWith(height: 1.45),
      bodyMedium: base.bodyMedium?.copyWith(height: 1.4),
      bodySmall: base.bodySmall?.copyWith(height: 1.35),
      labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.1),
      labelMedium: base.labelMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.2),
      labelSmall: base.labelSmall?.copyWith(fontWeight: FontWeight.w600, letterSpacing: 0.3),
    );
  }
}
