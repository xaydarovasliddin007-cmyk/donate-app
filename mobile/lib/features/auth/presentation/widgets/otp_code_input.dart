import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';

/// Six-box OTP-style code entry: a real (invisible) [TextField] drives input
/// and the keyboard, while the boxes below just mirror its value — this
/// keeps paste, backspace, and cursor behavior fully native instead of
/// hand-rolling focus traversal across six separate fields.
class OtpCodeInput extends StatelessWidget {
  const OtpCodeInput({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.hasError,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final bool hasError;

  static const _boxCount = 6;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () => focusNode.requestFocus(),
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: controller,
            builder: (context, _) {
              final text = controller.text;
              final activeIndex = text.length < _boxCount ? text.length : -1;
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(_boxCount, (index) {
                  final isActive = enabled && index == activeIndex;
                  final filled = index < text.length;
                  final borderColor = hasError
                      ? theme.colorScheme.error
                      : isActive
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outlineVariant;
                  return AnimatedContainer(
                    duration: AppMotion.fast,
                    width: 44,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      border: Border.all(
                        color: borderColor,
                        width: isActive ? 2 : 1,
                      ),
                    ),
                    child: Text(
                      filled ? text[index] : '',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  );
                }),
              );
            },
          ),
          Opacity(
            opacity: 0,
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              enabled: enabled,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(_boxCount),
              ],
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
