import 'package:flutter/material.dart';
import '../theme/app_motion.dart';
import '../utils/money_formatter.dart';

/// Animates a money value counting up/down to its new total instead of
/// snapping instantly — the small "counter" motion fintech apps use to make
/// a balance change feel acknowledged rather than just re-rendered.
class AnimatedBalance extends StatefulWidget {
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
  State<AnimatedBalance> createState() => _AnimatedBalanceState();
}

class _AnimatedBalanceState extends State<AnimatedBalance> {
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
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: _previous, end: widget.amountMinor),
      duration: AppMotion.medium,
      curve: AppMotion.standard,
      builder: (context, value, child) =>
          Text(formatMoney(value, widget.currency, widget.localeName), style: widget.style),
    );
  }
}
