import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_identifier_field.dart';
import 'widgets/google_auth_button.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _submitting = false;
  bool _googleSubmitting = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  String? _googleErrorMessage;

  bool get _busy => _submitting || _googleSubmitting;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    final email = _identifierController.text.trim();

    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(email: email, password: _passwordController.text);
      if (mounted) context.pop();
    } catch (error) {
      if (!mounted) return;
      final failure = Failure.from(error);
      setState(
        () => _errorMessage = failure.isUnauthorized
            ? l10n.errorUnauthorized
            : failure.message,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitGoogle() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _googleSubmitting = true;
      _googleErrorMessage = null;
    });

    try {
      final success = await ref
          .read(authControllerProvider.notifier)
          .signInWithGoogle();
      if (success && mounted) context.pop();
    } catch (error) {
      final failure = Failure.from(error);
      if (!mounted) return;
      final isDevError = error.toString().contains('10') ||
          error.toString().contains('DEVELOPER_ERROR') ||
          (failure.details != null &&
              failure.details.toString().contains('10'));
      setState(() {
        if (failure.code == 'GOOGLE_NOT_CONFIGURED') {
          _googleErrorMessage = l10n.authGoogleUnavailableMessage;
        } else if (isDevError) {
          _googleErrorMessage = Localizations.localeOf(context).languageCode == 'ru'
              ? 'Ошибка Google Play (SHA-1 не привязан в Google Cloud Console). Войдите по Email или продолжите как гость.'
              : 'Google Play xatosi (Google Cloud Console\'da SHA-1 ulanmagan). Email orqali kiring yoki Mehmon rejimida davom eting.';
        } else {
          _googleErrorMessage = l10n.authGoogleSignInFailed;
        }
      });
    } finally {
      if (mounted) setState(() => _googleSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.authLoginTitle)),
      body: SafeArea(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: reduceMotion ? Duration.zero : AppMotion.entrance,
          curve: AppMotion.standard,
          builder: (context, t, child) => Opacity(
            opacity: t,
            child: Transform.translate(
              offset: Offset(0, (1 - t) * 12),
              child: child,
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: BrandMark(size: 56)),
                const SizedBox(height: AppSpacing.xl),
                GoogleAuthButton(
                  label: l10n.authContinueWithGoogle,
                  loading: _googleSubmitting,
                  onPressed: _busy ? null : _submitGoogle,
                ),
                if (_googleErrorMessage != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _googleErrorMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: Divider(color: theme.colorScheme.outlineVariant),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                      child: Text(
                        l10n.authOrDivider,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                    Expanded(
                      child: Divider(color: theme.colorScheme.outlineVariant),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AuthIdentifierField(controller: _identifierController),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: l10n.authPasswordLabel,
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        validator: (value) =>
                            (value == null || value.length < 8)
                            ? l10n.authPasswordTooShort
                            : null,
                      ),
                      Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: TextButton(
                          onPressed: _busy
                              ? null
                              : () => context.push('/forgot-password'),
                          child: Text(l10n.authForgotPasswordLink),
                        ),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _errorMessage!,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _submitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(l10n.authLoginButton),
                      ),
                    ],
                  ),
                ),
                Center(
                  child: TextButton(
                    onPressed: _busy ? null : () => context.push('/register'),
                    child: Text(
                      '${l10n.authNoAccountPrompt} ${l10n.authSwitchToRegister}',
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Center(
                  child: TextButton.icon(
                    icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                    onPressed: _busy
                        ? null
                        : () {
                            if (context.canPop()) {
                              context.pop();
                            } else {
                              context.go('/home');
                            }
                          },
                    label: Text(
                      Localizations.localeOf(context).languageCode == 'ru'
                          ? 'Продолжить без входа (как гость)'
                          : 'Ro‘yxatdan o‘tmasdan ko‘rish (Mehmon)',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
