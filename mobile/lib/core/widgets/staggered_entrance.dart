import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/reduce_motion_controller.dart';

/// Wraps [child] in a small delayed fade/slide-up entrance, keyed off
/// [index] — used for grids/lists where items appearing in a quick
/// staggered wave reads as more alive than everything popping in at once.
/// The delay is capped so a long grid never feels slow to finish appearing,
/// and skipped entirely when the user has "reduce animations" on.
class StaggeredEntrance extends ConsumerStatefulWidget {
  const StaggeredEntrance({
    super.key,
    required this.index,
    required this.child,
  });

  final int index;
  final Widget child;

  @override
  ConsumerState<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends ConsumerState<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _startTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.sectionEntrance,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (ref.read(reduceMotionProvider) ||
        MediaQuery.disableAnimationsOf(context)) {
      _startTimer?.cancel();
      _controller.value = 1;
    } else if (_startTimer == null && _controller.value == 0) {
      final delayMs = (widget.index * 36).clamp(0, 220);
      _startTimer = Timer(Duration(milliseconds: delayMs), () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _startTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        ref.watch(reduceMotionProvider) ||
        MediaQuery.disableAnimationsOf(context);
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final t = reduceMotion
            ? 1.0
            : AppMotion.emphasized.transform(_controller.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 18 * (1 - t)),
            child: Transform.scale(
              scale: 0.97 + 0.03 * t,
              alignment: Alignment.topCenter,
              child: child,
            ),
          ),
        );
      },
    );
  }
}
