import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
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

    final identifier = _identifierController.text.trim();
    final isEmail = identifier.contains('@');

    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(
            email: isEmail ? identifier : null,
            phone: isEmail ? null : identifier,
            password: _passwordController.text,
          );
      if (mounted) context.pop();
    } catch (error) {
      final failure = Failure.from(error);
      setState(() => _errorMessage = failure.isUnauthorized ? l10n.errorUnauthorized : failure.message);
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
      final success = await ref.read(authControllerProvider.notifier).signInWithGoogle();
      if (success && mounted) context.pop();
    } catch (error) {
      final failure = Failure.from(error);
      if (!mounted) return;
      setState(() {
        _googleErrorMessage = failure.code == 'GOOGLE_NOT_CONFIGURED'
            ? l10n.authGoogleUnavailableMessage
            : l10n.authGoogleSignInFailed;
      });
    } finally {
      if (mounted) setState(() => _googleSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.authLoginTitle)),
      body: SafeArea(
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
                  Expanded(child: Divider(color: theme.colorScheme.outlineVariant)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: Text(l10n.authOrDivider, style: theme.textTheme.bodySmall),
                  ),
                  Expanded(child: Divider(color: theme.colorScheme.outlineVariant)),
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
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(labelText: l10n.authPasswordLabel),
                      validator: (value) =>
                          (value == null || value.length < 8) ? l10n.authPasswordTooShort : null,
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(_errorMessage!, style: TextStyle(color: theme.colorScheme.error)),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(l10n.authLoginButton),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Center(
                child: TextButton(
                  onPressed: _busy ? null : () => context.push('/register'),
                  child: Text('${l10n.authNoAccountPrompt} ${l10n.authSwitchToRegister}'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
