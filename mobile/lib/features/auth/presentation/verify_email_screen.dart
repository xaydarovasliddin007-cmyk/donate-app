import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/success_checkmark.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/auth_controller.dart';

/// Shown right after registration (and reachable later via a "verify your
/// email" prompt) — never a hard gate, since the account already works
/// without this; skipping just leaves [AppUser.isEmailVerified] false.
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _codeController = TextEditingController();
  bool _submitting = false;
  bool _resending = false;
  String? _errorMessage;

  final _codeFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _codeController.addListener(_onCodeChanged);
  }

  @override
  void dispose() {
    _codeController.removeListener(_onCodeChanged);
    _codeController.dispose();
    _codeFocusNode.dispose();
    super.dispose();
  }

  void _onCodeChanged() {
    setState(() {});
    if (_codeController.text.length == 6 && !_submitting) {
      _submit();
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final code = _codeController.text.trim();
    if (code.length != 6) {
      setState(() => _errorMessage = l10n.authVerifyEmailCodeInvalid);
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).verifyEmail(code);
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const SuccessCheckmark(),
          content: Text(l10n.authVerifyEmailTitle, textAlign: TextAlign.center),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonClose),
            ),
          ],
        ),
      );
      if (mounted) context.go('/home');
    } catch (error) {
      final failure = Failure.from(error);
      setState(() {
        _errorMessage = failure.isUnauthorized
            ? l10n.authVerifyEmailFailed
            : failure.message;
        _codeController.clear();
      });
      HapticFeedback.heavyImpact();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _resending = true);
    try {
      await ref.read(authControllerProvider.notifier).resendVerification();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocalizations.of(context).authVerifyEmailResendSuccess,
          ),
        ),
      );
    } catch (_) {
      // Best-effort — the user can just tap resend again.
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.authVerifyEmailTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.lg),
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.mark_email_read_outlined,
                    size: 36,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.authVerifyEmailMessage(widget.email),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              _OtpCodeInput(
                controller: _codeController,
                focusNode: _codeFocusNode,
                enabled: !_submitting,
                hasError: _errorMessage != null,
              ),
              if (_submitting) ...[
                const SizedBox(height: AppSpacing.lg),
                const Center(
                  child: SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ],
              if (_errorMessage != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              TextButton(
                onPressed: _resending ? null : _resend,
                child: _resending
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.authVerifyEmailResendButton),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/home'),
                  child: Text(l10n.authVerifyEmailSkipButton),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Six-box OTP-style code entry: a real (invisible) [TextField] drives input
/// and the keyboard, while the boxes below just mirror its value — this
/// keeps paste, backspace, and cursor behavior fully native instead of
/// hand-rolling focus traversal across six separate fields.
class _OtpCodeInput extends StatelessWidget {
  const _OtpCodeInput({
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
