import 'package:flutter/material.dart';
import '../../../../l10n/generated/app_localizations.dart';

/// Single "email or phone" field — the backend accepts either, so the UI
/// doesn't force the user to pick a mode upfront.
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
      decoration: InputDecoration(
        labelText: l10n.authIdentifierLabel,
        hintText: l10n.authIdentifierHint,
      ),
      validator: (value) => (value == null || value.trim().isEmpty) ? l10n.authIdentifierRequired : null,
    );
  }
}
