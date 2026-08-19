import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_motion.dart';
import '../theme/reduce_motion_controller.dart';
import '../utils/money_formatter.dart';

/// Animates a money value counting up/down to its new total instead of
/// snapping instantly — the small "counter" motion fintech apps use to make
/// a balance change feel acknowledged rather than just re-rendered. Skips
/// the count when the user has "reduce animations" on.
class AnimatedBalance extends ConsumerStatefulWidget {
  const AnimatedBalance({
    super.key,
    required this.amountMinor,
    required this.currency,
    required this.localeName,
    this.style,
  });

  final int amountMinor;
  final String currency;
  final String localeName;
  final TextStyle? style;

  @override
  ConsumerState<AnimatedBalance> createState() => _AnimatedBalanceState();
}

class _AnimatedBalanceState extends ConsumerState<AnimatedBalance> {
  late int _previous = widget.amountMinor;

  @override
  void didUpdateWidget(covariant AnimatedBalance oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.amountMinor != widget.amountMinor) {
      _previous = oldWidget.amountMinor;
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = ref.watch(reduceMotionProvider);
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: reduceMotion ? widget.amountMinor : _previous, end: widget.amountMinor),
      duration: reduceMotion ? Duration.zero : AppMotion.fast,
      curve: AppMotion.standard,
      builder: (context, value, child) =>
          Text(formatMoney(value, widget.currency, widget.localeName), style: widget.style),
    );
  }
}
