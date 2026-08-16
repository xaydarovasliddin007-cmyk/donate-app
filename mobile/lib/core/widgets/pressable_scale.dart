import 'package:flutter/material.dart';
import '../theme/app_motion.dart';

/// Wraps [child] with a subtle press-down scale (1.0 → 0.97) — the tactile
/// feedback that makes cards feel like real, physical buttons instead of
/// static Material containers. Cheap: purely an implicit [AnimatedScale],
/// no controller to manage/dispose.
class PressableScale extends StatefulWidget {
  const PressableScale({super.key, required this.child, this.onTap, this.borderRadius});

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.onTap == null) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: AppMotion.micro,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
