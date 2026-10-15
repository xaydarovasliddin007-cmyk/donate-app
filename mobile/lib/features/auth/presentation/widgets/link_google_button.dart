import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/errors/failure.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../application/auth_controller.dart';

class LinkGoogleButton extends ConsumerStatefulWidget {
  const LinkGoogleButton({super.key});
  @override
  ConsumerState<LinkGoogleButton> createState() => _LinkGoogleButtonState();
}

class _LinkGoogleButtonState extends ConsumerState<LinkGoogleButton> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: _busy
        ? null
        : () async {
            setState(() => _busy = true);
            try {
              await ref
                  .read(authControllerProvider.notifier)
                  .signInWithGoogle(linkToCurrentAccount: true);
            } catch (error) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(Failure.from(error).message)),
                );
              }
            } finally {
              if (mounted) setState(() => _busy = false);
            }
          },
    child: Text(AppLocalizations.of(context).securityLinkGoogle),
  );
}
