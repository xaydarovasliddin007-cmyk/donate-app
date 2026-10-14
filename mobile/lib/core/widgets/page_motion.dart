import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/reduce_motion_controller.dart';

/// A shared spatial rhythm for pushed pages, without animating their data.
class BrandPageTransition extends StatelessWidget {
  const BrandPageTransition({
    super.key,
    required this.animation,
    required this.secondaryAnimation,
    required this.child,
    this.reduceMotion = false,
  });

  final Animation<double> animation;
  final Animation<double> secondaryAnimation;
  final Widget child;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion || MediaQuery.disableAnimationsOf(context)) return child;
    final arrive = animation.drive(CurveTween(curve: AppMotion.emphasized));
    final leave = secondaryAnimation.drive(
      CurveTween(curve: AppMotion.standard),
    );
    return AnimatedBuilder(
      animation: Listenable.merge([arrive, leave]),
      child: child,
      builder: (context, child) => Opacity(
        opacity: (arrive.value * (1 - leave.value * 0.16)).clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, (1 - arrive.value) * 22 - leave.value * 5),
          child: Transform.scale(
            scale: 0.985 + 0.015 * arrive.value - 0.015 * leave.value,
            alignment: Alignment.topCenter,
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Reveals a new tab while retaining the existing navigation shell subtree,
/// so scroll positions, forms and nested navigation stacks survive switches.
class TabReveal extends ConsumerStatefulWidget {
  const TabReveal({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  ConsumerState<TabReveal> createState() => _TabRevealState();
}

class _TabRevealState extends ConsumerState<TabReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  double _direction = 1;

  bool get _reduceMotion =>
      ref.read(reduceMotionProvider) || MediaQuery.disableAnimationsOf(context);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.medium,
      value: 1,
    );
  }

  @override
  void didUpdateWidget(covariant TabReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) {
      _direction = widget.index > oldWidget.index ? 1 : -1;
      if (_reduceMotion) {
        _controller.value = 1;
      } else {
        _controller.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced =
        ref.watch(reduceMotionProvider) ||
        MediaQuery.disableAnimationsOf(context);
    // Keep the hierarchy identical even when the preference changes.
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final t = reduced
            ? 1.0
            : AppMotion.emphasized.transform(_controller.value);
        return Opacity(
          opacity: 0.72 + t * 0.28,
          child: Transform.translate(
            offset: Offset((1 - t) * 12 * _direction, (1 - t) * 3),
            child: child,
          ),
        );
      },
    );
  }
}
