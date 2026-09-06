import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/errors/failure.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/auth_controller.dart';
import 'widgets/auth_identifier_field.dart';
import 'widgets/google_auth_button.dart';

/// Step 1 of registration: just email + optional display name. No password
/// here — that's set on the next screen only after the emailed code is
/// confirmed, so a typo'd/unowned email can never end up with a live,
/// password-protected account attached to it.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _displayNameController = TextEditingController();
  bool _submitting = false;
  bool _googleSubmitting = false;
  String? _errorMessage;
  String? _googleErrorMessage;

  bool get _busy => _submitting || _googleSubmitting;

  @override
  void dispose() {
    _identifierController.dispose();
    _displayNameController.dispose();
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
    final rawDisplayName = _displayNameController.text.trim();
    final displayName = rawDisplayName.isEmpty ? null : rawDisplayName;
    final locale = ref.read(localeControllerProvider).languageCode;

    try {
      await ref
          .read(authControllerProvider.notifier)
          .registerRequestCode(
            email: email,
            displayName: displayName,
            locale: locale,
          );
      if (mounted) {
        context.pushReplacement(
          '/register/complete',
          extra: {'email': email, 'displayName': displayName},
        );
      }
    } catch (error) {
      if (!mounted) return;
      final failure = Failure.from(error);
      setState(
        () => _errorMessage = failure.code == 'CONFLICT'
            ? l10n.errorConflict
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
      appBar: AppBar(title: Text(l10n.authRegisterTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: BrandMark(size: 52)),
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
                      controller: _displayNameController,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: l10n.authDisplayNameLabel,
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.sm,
                        ),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer.withValues(
                            alpha: 0.5,
                          ),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(l10n.authRegisterButton),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Center(
                child: TextButton(
                  onPressed: _busy
                      ? null
                      : () => context.pushReplacement('/login'),
                  child: Text(
                    '${l10n.authHaveAccountPrompt} ${l10n.authSwitchToLogin}',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
