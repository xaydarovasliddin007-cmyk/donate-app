import 'package:flutter/material.dart';

/// UZDONATE's compact line icons share a 24-point grid, round ends and
/// a small open corner. Keep product navigation consistent across screens.
enum BrandSymbol {
  home,
  catalog,
  orders,
  profile,
  wallet,
  search,
  arrowRight,
  add,
  history,
  shield,
  spark,
}

class BrandIcon extends StatelessWidget {
  const BrandIcon(
    this.symbol, {
    super.key,
    this.size = 24,
    this.color,
    this.selected = false,
  });

  final BrandSymbol symbol;
  final double size;
  final Color? color;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _BrandIconPainter(
          symbol,
          color ?? IconTheme.of(context).color ?? Colors.black,
          selected,
        ),
      ),
    );
  }
}

class _BrandIconPainter extends CustomPainter {
  const _BrandIconPainter(this.symbol, this.color, this.selected);

  final BrandSymbol symbol;
  final Color color;
  final bool selected;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 2.1 : 1.7
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = color;
    final path = Path();

    switch (symbol) {
      case BrandSymbol.home:
        path
          ..moveTo(3, 10.5)
          ..lineTo(12, 3)
          ..lineTo(21, 10.5)
          ..moveTo(5.5, 9.5)
          ..lineTo(5.5, 20)
          ..lineTo(9.5, 20)
          ..lineTo(9.5, 14)
          ..lineTo(14.5, 14)
          ..lineTo(14.5, 20)
          ..lineTo(18.5, 20)
          ..lineTo(18.5, 13);
      case BrandSymbol.catalog:
        path
          ..moveTo(8, 7)
          ..lineTo(16, 7)
          ..cubicTo(18.5, 7, 20, 9, 20.5, 12)
          ..lineTo(21.3, 16.5)
          ..cubicTo(21.7, 19, 19.5, 20, 18, 18.4)
          ..lineTo(15.7, 16)
          ..lineTo(8.3, 16)
          ..lineTo(6, 18.4)
          ..cubicTo(4.5, 20, 2.3, 19, 2.7, 16.5)
          ..lineTo(3.5, 12)
          ..cubicTo(4, 9, 5.5, 7, 8, 7)
          ..moveTo(6.5, 11.5)
          ..lineTo(6.5, 15)
          ..moveTo(4.8, 13.2)
          ..lineTo(8.2, 13.2);
        canvas.drawCircle(const Offset(16.3, 11.7), 1, fill);
        canvas.drawCircle(const Offset(18.5, 14), 1, fill);
      case BrandSymbol.orders:
        path
          ..moveTo(18.5, 10)
          ..lineTo(18.5, 21)
          ..lineTo(15.2, 19)
          ..lineTo(12, 21)
          ..lineTo(8.8, 19)
          ..lineTo(5.5, 21)
          ..lineTo(5.5, 3)
          ..lineTo(14, 3)
          ..lineTo(18.5, 7.5)
          ..lineTo(14, 7.5)
          ..lineTo(14, 3)
          ..moveTo(9, 11.5)
          ..lineTo(15, 11.5)
          ..moveTo(9, 15)
          ..lineTo(13, 15);
      case BrandSymbol.profile:
        canvas.drawCircle(const Offset(12, 7.5), 4, stroke);
        path
          ..moveTo(4, 21)
          ..lineTo(4, 19)
          ..cubicTo(4, 16.5, 7.5, 14.5, 12, 14.5)
          ..cubicTo(16.5, 14.5, 20, 16.5, 20, 19)
          ..lineTo(20, 21)
          ..lineTo(15, 21);
      case BrandSymbol.wallet:
        path
          ..moveTo(19, 7.5)
          ..lineTo(19, 4)
          ..lineTo(4.8, 6.8)
          ..quadraticBezierTo(3, 7.2, 3, 9)
          ..lineTo(3, 18.5)
          ..quadraticBezierTo(3, 20, 4.5, 20)
          ..lineTo(20, 20)
          ..lineTo(20, 16.5)
          ..moveTo(5, 8.5)
          ..lineTo(20, 8.5)
          ..lineTo(20, 11.5)
          ..lineTo(15.5, 11.5)
          ..quadraticBezierTo(13, 11.5, 13, 14)
          ..quadraticBezierTo(13, 16.5, 15.5, 16.5)
          ..lineTo(21, 16.5)
          ..lineTo(21, 11.5);
        canvas.drawCircle(const Offset(16, 14), 0.8, fill);
      case BrandSymbol.search:
        canvas.drawCircle(const Offset(10.5, 10.5), 6.7, stroke);
        path
          ..moveTo(15.5, 15.5)
          ..lineTo(21, 21);
      case BrandSymbol.arrowRight:
        path
          ..moveTo(4, 12)
          ..lineTo(20, 12)
          ..moveTo(14, 6)
          ..lineTo(20, 12)
          ..lineTo(14, 18);
      case BrandSymbol.add:
        path
          ..moveTo(12, 5)
          ..lineTo(12, 19)
          ..moveTo(5, 12)
          ..lineTo(19, 12);
      case BrandSymbol.history:
        path
          ..moveTo(4, 10)
          ..cubicTo(5, 5, 10, 2.7, 14.5, 4.2)
          ..cubicTo(19, 5.5, 21.5, 10.3, 20, 15)
          ..cubicTo(18.5, 19.6, 13.5, 22, 9, 20)
          ..moveTo(3.5, 4.8)
          ..lineTo(3.5, 10)
          ..lineTo(8.5, 10)
          ..moveTo(12, 7.5)
          ..lineTo(12, 12)
          ..lineTo(15.5, 14);
      case BrandSymbol.shield:
        path
          ..moveTo(12, 3)
          ..lineTo(20, 6)
          ..lineTo(20, 11)
          ..cubicTo(20, 15.5, 17, 19, 12, 21)
          ..cubicTo(7, 19, 4, 15.5, 4, 11)
          ..lineTo(4, 6)
          ..lineTo(12, 3)
          ..moveTo(8, 11.5)
          ..lineTo(11, 14.5)
          ..lineTo(16, 9);
      case BrandSymbol.spark:
        path
          ..moveTo(12, 2.5)
          ..lineTo(14.5, 9.5)
          ..lineTo(21.5, 12)
          ..lineTo(14.5, 14.5)
          ..lineTo(12, 21.5)
          ..lineTo(9.5, 14.5)
          ..lineTo(2.5, 12)
          ..lineTo(9.5, 9.5)
          ..close();
    }
    canvas.drawPath(path, stroke);
  }

  @override
  bool shouldRepaint(covariant _BrandIconPainter oldDelegate) {
    return oldDelegate.symbol != symbol ||
        oldDelegate.color != color ||
        oldDelegate.selected != selected;
  }
}
