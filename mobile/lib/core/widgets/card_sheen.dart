import 'package:flutter/material.dart';

/// A single diagonal light sweep across [child], shortly after mount —
/// the classic "premium card catching light" touch fintech apps use on a
/// balance/payment card. Plays once, then stays still; skipped entirely
/// when [enabled] is false (wired to the user's "reduce animations"
/// setting by the caller).
class CardSheen extends StatefulWidget {
  const CardSheen({
    super.key,
    required this.child,
    required this.borderRadius,
    this.enabled = true,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final bool enabled;

  @override
  State<CardSheen> createState() => _CardSheenState();
}

class _CardSheenState extends State<CardSheen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void initState() {
    super.initState();
    if (widget.enabled) {
      Future.delayed(const Duration(milliseconds: 450), () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: widget.borderRadius,
      child: Stack(
        children: [
          widget.child,
          if (widget.enabled)
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) {
                    return LayoutBuilder(
                      builder: (context, constraints) {
                        final t = Curves.easeInOut.transform(_controller.value);
                        final dx =
                            -constraints.maxWidth * 0.6 +
                            t * constraints.maxWidth * 1.7;
                        return Transform.translate(
                          offset: Offset(dx, 0),
                          child: Transform.rotate(
                            angle: -0.35,
                            child: Container(
                              width: constraints.maxWidth * 0.28,
                              height: constraints.maxHeight * 2.2,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.white.withValues(alpha: 0),
                                    Colors.white.withValues(alpha: 0.24),
                                    Colors.white.withValues(alpha: 0),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}
