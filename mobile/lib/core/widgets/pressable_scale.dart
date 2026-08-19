import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/reduce_motion_controller.dart';

/// Wraps [child] with a subtle press-down scale (1.0 → 0.97) — the tactile
/// feedback that makes cards feel like real, physical buttons instead of
/// static Material containers. Cheap: purely an implicit [AnimatedScale],
/// no controller to manage/dispose. Honors the user's "reduce animations"
/// setting by collapsing the duration to near-zero instead of skipping the
/// scale outright (still gives instant, non-jarring press feedback).
class PressableScale extends ConsumerStatefulWidget {
  const PressableScale({super.key, required this.child, this.onTap, this.borderRadius});

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  @override
  ConsumerState<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends ConsumerState<PressableScale> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.onTap == null) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = ref.watch(reduceMotionProvider);
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: reduceMotion ? Duration.zero : AppMotion.micro,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
