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

class _StaggeredEntranceState extends ConsumerState<StaggeredEntrance> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    final reduceMotion = ref.read(reduceMotionProvider);
    if (reduceMotion) {
      _visible = true;
      return;
    }
    final delayMs = (widget.index * 18).clamp(0, 140);
    Future.delayed(Duration(milliseconds: delayMs), () {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = ref.watch(reduceMotionProvider);
    final duration = reduceMotion ? Duration.zero : AppMotion.fast;
    return AnimatedOpacity(
      opacity: _visible ? 1 : 0,
      duration: duration,
      curve: AppMotion.standard,
      child: AnimatedSlide(
        offset: _visible ? Offset.zero : const Offset(0, 0.05),
        duration: duration,
        curve: AppMotion.standard,
        child: widget.child,
      ),
    );
  }
}
