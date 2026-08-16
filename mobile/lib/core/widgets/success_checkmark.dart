import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_motion.dart';

/// A small "pop in" success indicator — used anywhere an action just
/// completed successfully (top-up submitted, order finished) so success
/// reads as a moment, not just a text label appearing.
class SuccessCheckmark extends StatelessWidget {
  const SuccessCheckmark({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: AppMotion.entrance,
      curve: Curves.elasticOut,
      builder: (context, t, child) => Transform.scale(scale: t.clamp(0.0, 1.2), child: child),
      child: Icon(Icons.check_circle_rounded, color: AppColors.success, size: size),
    );
  }
}
