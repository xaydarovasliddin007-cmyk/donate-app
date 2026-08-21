import 'package:flutter/material.dart';
import '../../../../l10n/generated/app_localizations.dart';

final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Email field for login/register — phone-based auth was removed, so this
/// no longer needs to guess which kind of identifier the user typed.
class AuthIdentifierField extends StatelessWidget {
  const AuthIdentifierField({super.key, required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      autocorrect: false,
      decoration: InputDecoration(
        labelText: l10n.authIdentifierLabel,
        hintText: l10n.authIdentifierHint,
        prefixIcon: const Icon(Icons.mail_outline_rounded),
      ),
      validator: (value) {
        final trimmed = value?.trim() ?? '';
        if (trimmed.isEmpty) return l10n.authIdentifierRequired;
        if (!_emailPattern.hasMatch(trimmed)) return l10n.authIdentifierInvalid;
        return null;
      },
    );
  }
}
