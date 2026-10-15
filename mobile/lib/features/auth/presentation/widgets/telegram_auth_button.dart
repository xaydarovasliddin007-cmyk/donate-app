import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/errors/failure.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../application/auth_controller.dart';
import '../../data/auth_api.dart';

class TelegramAuthButton extends StatelessWidget {
  const TelegramAuthButton({
    super.key,
    this.linkToCurrentAccount = false,
    this.enabled = true,
    this.onSuccess,
    this.provider = 'telegram',
  });
  final String provider;
  final bool linkToCurrentAccount;
  final bool enabled;
  final VoidCallback? onSuccess;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final callback = !enabled
        ? null
        : () async {
            final result = await showDialog<bool>(
              context: context,
              barrierDismissible: false,
              builder: (_) => _TelegramCodeDialog(
                link: linkToCurrentAccount,
                provider: provider,
              ),
            );
            if (result == true && context.mounted) onSuccess?.call();
          };
    return provider == 'google'
        ? TextButton.icon(
            onPressed: callback,
            icon: const Icon(Icons.open_in_browser),
            label: Text(l10n.authGoogleOpenBrowser),
          )
        : OutlinedButton.icon(
            onPressed: callback,
            icon: const Icon(Icons.telegram),
            label: Text(
              linkToCurrentAccount
                  ? l10n.authLinkTelegram
                  : l10n.authContinueWithTelegram,
            ),
          );
  }
}

class GoogleBrowserAuthButton extends TelegramAuthButton {
  const GoogleBrowserAuthButton({
    super.key,
    super.linkToCurrentAccount,
    super.enabled,
    super.onSuccess,
  }) : super(provider: 'google');
}

class _TelegramCodeDialog extends ConsumerStatefulWidget {
  const _TelegramCodeDialog({required this.link, required this.provider});
  final bool link;
  final String provider;
  @override
  ConsumerState<_TelegramCodeDialog> createState() =>
      _TelegramCodeDialogState();
}

class _TelegramCodeDialogState extends ConsumerState<_TelegramCodeDialog> {
  final _code = TextEditingController();
  SocialAuthRequest? _request;
  bool _busy = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    Future.microtask(_start);
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final url = Uri.tryParse(_request?.authorizeUrl ?? '');
    final allowed = widget.provider == 'telegram'
        ? const {'t.me'}
        : const {'uzdonate.uz', 'donate-app-5vhs.onrender.com'};
    if (url == null ||
        url.scheme != 'https' ||
        !allowed.contains(url.host) ||
        !await launchUrl(url, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        setState(
          () => _error = widget.provider == 'telegram'
              ? AppLocalizations.of(context).authTelegramOpenFailed
              : AppLocalizations.of(context).authBrowserOpenFailed,
        );
      }
    }
  }

  Future<void> _start() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _request = null;
      _code.clear();
    });
    try {
      final request = await ref
          .read(authControllerProvider.notifier)
          .startSocialSignIn(
            provider: widget.provider,
            linkToCurrentAccount: widget.link,
          );
      if (!mounted) return;
      setState(() => _request = request);
      await _open();
    } catch (error) {
      if (mounted) setState(() => _error = Failure.from(error).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    if (_request == null || _busy || _code.text.length != 8) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .completeSocialSignIn(_request!, _code.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context);
      setState(
        () => _error = error is ApiException && error.statusCode == 401
            ? l10n.authTelegramCodeInvalid
            : error is ApiException && error.statusCode == 409
            ? widget.provider == 'telegram'
                  ? l10n.authTelegramAccountConflict
                  : l10n.authGoogleLinkConflict
            : Failure.from(error).message,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(
        widget.provider == 'google'
            ? widget.link
                  ? l10n.securityLinkGoogle
                  : l10n.authContinueWithGoogle
            : widget.link
            ? l10n.authLinkTelegram
            : l10n.authContinueWithTelegram,
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.provider == 'google'
                  ? l10n.authGoogleBrowserCodeHint
                  : l10n.authTelegramCodeHint,
            ),
            const SizedBox(height: 16),
            if (_request != null) ...[
              OutlinedButton.icon(
                onPressed: _busy ? null : _open,
                icon: const Icon(Icons.open_in_new),
                label: Text(
                  widget.provider == 'google'
                      ? l10n.authGoogleOpenBrowser
                      : l10n.authTelegramOpen,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                autofillHints: const [AutofillHints.oneTimeCode],
                maxLength: 8,
                enabled: !_busy,
                decoration: InputDecoration(
                  labelText: widget.provider == 'google'
                      ? l10n.authGoogleBrowserCodeLabel
                      : l10n.authTelegramCodeLabel,
                ),
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _confirm(),
              ),
            ],
            if (_busy)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(12),
                  child: CircularProgressIndicator(),
                ),
              ),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            TextButton(
              onPressed: _busy ? null : _start,
              child: Text(l10n.authTelegramRestart),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          onPressed: !_busy && _request != null && _code.text.length == 8
              ? _confirm
              : null,
          child: Text(l10n.authTelegramConfirm),
        ),
      ],
    );
  }
}
