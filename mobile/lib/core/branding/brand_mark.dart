import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'app_branding.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.size = 40,
    this.showWordmark = false,
    this.wordmarkColor,
  });

  final double size;
  final bool showWordmark;
  final Color? wordmarkColor;

  @override
  Widget build(BuildContext context) {
    final mark = SvgPicture.asset(
      'assets/branding/brand-mark.svg',
      width: size,
      height: size,
      semanticsLabel: showWordmark ? null : AppBranding.appName,
      excludeFromSemantics: showWordmark,
    );

    if (!showWordmark) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.32),
        Flexible(
          child: Text(
            AppBranding.appName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: size * 0.46,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: wordmarkColor ?? Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
      ],
    );
  }
}
