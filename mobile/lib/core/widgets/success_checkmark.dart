import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../theme/app_motion.dart';

/// A small "pop in" success indicator with a matching haptic thump — used
/// anywhere an action just completed successfully (top-up submitted, order
/// finished) so success reads as a moment, not just a text label appearing.
class SuccessCheckmark extends StatefulWidget {
  const SuccessCheckmark({super.key, this.size = 40});

  final double size;

  @override
  State<SuccessCheckmark> createState() => _SuccessCheckmarkState();
}

class _SuccessCheckmarkState extends State<SuccessCheckmark> {
  @override
  void initState() {
    super.initState();
    HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: AppMotion.entrance,
      curve: Curves.elasticOut,
      builder: (context, t, child) =>
          Transform.scale(scale: t.clamp(0.0, 1.2), child: child),
      child: Icon(
        Icons.check_circle_rounded,
        color: AppColors.success,
        size: widget.size,
      ),
    );
  }
}
