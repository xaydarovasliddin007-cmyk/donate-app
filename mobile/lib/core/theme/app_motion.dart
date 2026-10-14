import 'package:flutter/animation.dart';

/// A single rhythm: quick input response, soft section settles and a finite
/// cinematic brand introduction. None of these timings gate network work.
abstract final class AppMotion {
  /// Button presses, chip selection, small state toggles.
  static const micro = Duration(milliseconds: 150);

  /// Card press feedback, tab switches, focus rings.
  static const fast = Duration(milliseconds: 200);

  /// Page/section transitions.
  static const medium = Duration(milliseconds: 280);

  /// Large entrance animations (splash, hero, success states).
  static const entrance = Duration(milliseconds: 400);

  static const sectionEntrance = Duration(milliseconds: 520);
  static const pressDown = Duration(milliseconds: 100);
  static const pressRelease = Duration(milliseconds: 330);
  static const route = Duration(milliseconds: 380);
  static const brandIntro = Duration(milliseconds: 1680);

  static const Curve standard = Curves.easeOutCubic;
  static const Curve emphasized = Curves.easeOutQuint;
  static const Curve decelerate = Curves.decelerate;
}
