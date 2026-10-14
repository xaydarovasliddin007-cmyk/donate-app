import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_motion.dart';
import 'app_branding.dart';
import 'brand_mark.dart';

/// A finite brand introduction: orbit, logo settle, wordmark and soft exit.
/// Auth hydration runs independently; completion only controls presentation.
class BrandEntrance extends StatefulWidget {
  const BrandEntrance({
    super.key,
    required this.onComplete,
    this.reduceMotion = false,
  });

  final VoidCallback onComplete;
  final bool reduceMotion;

  @override
  State<BrandEntrance> createState() => _BrandEntranceState();
}

class _BrandEntranceState extends State<BrandEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _completionScheduled = false;

  @override
  void initState() {
    super.initState();
    _controller =
        AnimationController(vsync: this, duration: AppMotion.brandIntro)
          ..addStatusListener((status) {
            if (status == AnimationStatus.completed) _complete();
          });
    if (widget.reduceMotion) {
      _complete();
    } else {
      _controller.forward();
    }
  }

  @override
  void didUpdateWidget(covariant BrandEntrance oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.reduceMotion && !oldWidget.reduceMotion) {
      _controller.stop();
      _complete();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
      _complete();
    }
  }

  void _complete() {
    if (_completionScheduled) return;
    _completionScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onComplete();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final reduceMotion =
        widget.reduceMotion || MediaQuery.disableAnimationsOf(context);
    return Semantics(
      label: AppBranding.appName,
      image: true,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final t = reduceMotion ? 0.7 : _controller.value;
              final reveal = _phase(t, 0, 0.32, AppMotion.emphasized);
              final settle = _phase(t, 0.04, 0.48, Curves.easeOutBack);
              final exit = reduceMotion
                  ? 0.0
                  : _phase(t, 0.84, 1, Curves.easeInCubic);
              final atmosphere = reveal * (1 - exit);

              return Stack(
                fit: StackFit.expand,
                children: [
                  Center(
                    child: Opacity(
                      opacity: atmosphere,
                      child: Container(
                        width: 420,
                        height: 420,
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            colors: [
                              AppColors.brandPrimary.withValues(
                                alpha: isDark ? 0.18 : 0.10,
                              ),
                              AppColors.brandAccent.withValues(
                                alpha: isDark ? 0.045 : 0.035,
                              ),
                              AppColors.brandAccent.withValues(alpha: 0),
                            ],
                            stops: const [0, 0.45, 1],
                          ),
                        ),
                      ),
                    ),
                  ),
                  Center(
                    child: Opacity(
                      opacity: (reveal * (1 - exit)).clamp(0.0, 1.0),
                      child: Transform.translate(
                        offset: Offset(0, -14 * exit),
                        child: Transform.scale(
                          scale: 1 + 0.025 * exit,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox.square(
                                dimension: 224,
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    if (!reduceMotion)
                                      Positioned.fill(
                                        child: CustomPaint(
                                          painter: _BrandOrbitPainter(
                                            progress: t,
                                            isDark: isDark,
                                          ),
                                        ),
                                      ),
                                    Transform.translate(
                                      offset: Offset(0, 18 * (1 - settle)),
                                      child: Transform.rotate(
                                        angle: -0.10 * (1 - settle),
                                        child: Transform.scale(
                                          scale: 0.78 + 0.22 * settle,
                                          child: DecoratedBox(
                                            decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(30),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: AppColors.brandPrimary
                                                      .withValues(
                                                        alpha:
                                                            0.20 * atmosphere,
                                                      ),
                                                  blurRadius: 36,
                                                  spreadRadius: -6,
                                                  offset: const Offset(0, 14),
                                                ),
                                              ],
                                            ),
                                            child: const BrandMark(size: 100),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 2),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 32,
                                ),
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      for (
                                        var i = 0;
                                        i < AppBranding.appName.length;
                                        i++
                                      )
                                        _LetterReveal(
                                          letter: AppBranding.appName[i],
                                          progress: _phase(
                                            t,
                                            0.26 + i * 0.035,
                                            0.42 + i * 0.035,
                                            AppMotion.emphasized,
                                          ),
                                          color: theme.colorScheme.onSurface,
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 18),
                              Container(
                                height: 3,
                                width: 44 * _phase(t, 0.5, 0.73),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  gradient: const LinearGradient(
                                    colors: [
                                      AppColors.brandPrimary,
                                      AppColors.brandAccent,
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

double _phase(
  double value,
  double start,
  double end, [
  Curve curve = Curves.easeOutCubic,
]) => curve.transform(((value - start) / (end - start)).clamp(0.0, 1.0));

class _LetterReveal extends StatelessWidget {
  const _LetterReveal({
    required this.letter,
    required this.progress,
    required this.color,
  });

  final String letter;
  final double progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: progress,
      child: Transform.translate(
        offset: Offset(0, 14 * (1 - progress)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 0.8),
          child: Text(
            letter,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: color,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandOrbitPainter extends CustomPainter {
  const _BrandOrbitPainter({required this.progress, required this.isDark});

  final double progress;
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final arrive = _phase(progress, 0, 0.38);
    final recede = 1 - _phase(progress, 0.7, 0.96);
    final visible = arrive * recede;
    final orbit = _phase(progress, 0.04, 0.86, Curves.easeInOutCubic);
    final rect = Rect.fromCenter(
      center: center,
      width: 184 + 14 * (1 - arrive),
      height: 184 + 14 * (1 - arrive),
    );
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    stroke
      ..color = AppColors.brandPrimary.withValues(alpha: 0.11 * visible)
      ..strokeWidth = 1;
    canvas.drawOval(rect, stroke);
    final rotation = -math.pi / 2 + math.pi * 1.3 * orbit;
    stroke
      ..color = AppColors.brandAccent.withValues(alpha: 0.78 * visible)
      ..strokeWidth = 2;
    canvas.drawArc(rect, rotation, 1.15 * arrive, false, stroke);
    stroke
      ..color = AppColors.brandPrimary.withValues(alpha: 0.55 * visible)
      ..strokeWidth = 1.5;
    canvas.drawArc(
      rect.inflate(13),
      -rotation + 1.7,
      0.7 * arrive,
      false,
      stroke,
    );
    final dot = Offset(
      center.dx + rect.width / 2 * math.cos(rotation),
      center.dy + rect.height / 2 * math.sin(rotation),
    );
    canvas.drawCircle(
      dot,
      7,
      Paint()..color = AppColors.brandAccent.withValues(alpha: 0.10 * visible),
    );
    canvas.drawCircle(
      dot,
      2.3,
      Paint()..color = AppColors.brandAccent.withValues(alpha: visible),
    );
    final pulse = _phase(progress, 0.1, 0.65);
    stroke
      ..color = AppColors.brandPrimary.withValues(
        alpha: (isDark ? 0.20 : 0.12) * (1 - pulse) * visible,
      )
      ..strokeWidth = 1;
    canvas.drawCircle(center, 62 + 47 * pulse, stroke);
  }

  @override
  bool shouldRepaint(covariant _BrandOrbitPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.isDark != isDark;
}
