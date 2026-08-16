import 'package:flutter/animation.dart';

/// Centralized animation timings so motion feels consistent across the app
/// instead of every screen picking its own duration. Kept fast on purpose —
/// per the product's #1 rule, the app must never feel slower for being
/// prettier.
abstract final class AppMotion {
  /// Button presses, chip selection, small state toggles.
  static const micro = Duration(milliseconds: 150);

  /// Card press feedback, tab switches, focus rings.
  static const fast = Duration(milliseconds: 200);

  /// Page/section transitions.
  static const medium = Duration(milliseconds: 280);

  /// Large entrance animations (splash, hero, success states).
  static const entrance = Duration(milliseconds: 400);

  static const Curve standard = Curves.easeOutCubic;
  static const Curve emphasized = Curves.easeOutQuint;
  static const Curve decelerate = Curves.decelerate;
}
