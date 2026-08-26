import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../theme/app_motion.dart';
import '../theme/app_spacing.dart';

/// Pops a small pill up from the bottom of the screen confirming a copy
/// action, then slides it back down and removes itself — the shared
/// feedback for every copy-to-clipboard button in the app, so copying a
/// card number or an amount always feels the same instead of silently
/// doing nothing visible.
void showCopiedToast(
  BuildContext context, {
  required String message,
  bool reduceMotion = false,
}) {
  final overlay = Overlay.of(context);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) => _CopiedToast(
      message: message,
      reduceMotion: reduceMotion,
      onDone: () => entry.remove(),
    ),
  );
  overlay.insert(entry);
}

class _CopiedToast extends StatefulWidget {
  const _CopiedToast({
    required this.message,
    required this.reduceMotion,
    required this.onDone,
  });

  final String message;
  final bool reduceMotion;
  final VoidCallback onDone;

  @override
  State<_CopiedToast> createState() => _CopiedToastState();
}

class _CopiedToastState extends State<_CopiedToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _entrance;

  @override
  void initState() {
    super.initState();
    HapticFeedback.lightImpact();
    _controller = AnimationController(
      vsync: this,
      duration: widget.reduceMotion ? Duration.zero : AppMotion.medium,
    );
    _entrance = CurvedAnimation(
      parent: _controller,
      curve: AppMotion.emphasized,
      reverseCurve: Curves.easeIn,
    );
    _run();
  }

  Future<void> _run() async {
    await _controller.forward();
    await Future.delayed(const Duration(milliseconds: 1100));
    if (!mounted) return;
    await _controller.reverse();
    widget.onDone();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Positioned(
      left: AppSpacing.lg,
      right: AppSpacing.lg,
      bottom: 32,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _entrance,
          builder: (context, child) => Opacity(
            opacity: _entrance.value.clamp(0.0, 1.0),
            child: Transform.translate(
              offset: Offset(0, (1 - _entrance.value) * 36),
              child: child,
            ),
          ),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.sm + 4,
              ),
              decoration: BoxDecoration(
                color: theme.colorScheme.inverseSurface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.28),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.check_circle_rounded,
                    size: 18,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      widget.message,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onInverseSurface,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
