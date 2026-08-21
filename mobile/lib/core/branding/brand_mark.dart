import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'app_branding.dart';

/// The UZDONATE mark: a rounded gradient monogram (a bolt — instant top-up)
/// plus an optional wordmark. Vector-only by design: no image asset, no
/// emoji, no network dependency, so it always renders identically and
/// instantly everywhere it's used (splash, login, home header).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40, this.showWordmark = false});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final mark = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brandPrimary, AppColors.brandPrimaryDark],
        ),
      ),
      alignment: Alignment.center,
      child: CustomPaint(
        size: Size(size * 0.46, size * 0.46),
        painter: _BoltPainter(),
      ),
    );

    if (!showWordmark) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.32),
        Text(
          AppBranding.appName,
          style: TextStyle(
            fontSize: size * 0.46,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
      ],
    );
  }
}

class _BoltPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.55, 0)
      ..lineTo(size.width * 0.08, size.height * 0.58)
      ..lineTo(size.width * 0.42, size.height * 0.58)
      ..lineTo(size.width * 0.35, size.height)
      ..lineTo(size.width * 0.96, size.height * 0.38)
      ..lineTo(size.width * 0.58, size.height * 0.38)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
