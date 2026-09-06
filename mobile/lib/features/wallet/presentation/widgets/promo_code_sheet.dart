import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/errors/failure.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/success_checkmark.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../application/wallet_providers.dart';

/// Opens the promo-code redemption bottom sheet, then (on success) shows a
/// confirmation dialog with the actual amount credited before refreshing
/// [walletProvider] so the balance card updates without a manual pull-to-refresh.
Future<void> showPromoCodeSheet(BuildContext context, WidgetRef ref) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => const _PromoCodeSheet(),
  );
}

class _PromoCodeSheet extends ConsumerStatefulWidget {
  const _PromoCodeSheet();

  @override
  ConsumerState<_PromoCodeSheet> createState() => _PromoCodeSheetState();
}

class _PromoCodeSheetState extends ConsumerState<_PromoCodeSheet> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    final l10n = AppLocalizations.of(context);
    final code = _controller.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    final localeName = Localizations.localeOf(context).toString();
    final previousBalance = ref.read(walletProvider).value?.balanceMinor ?? 0;

    try {
      final updated = await ref.read(walletApiProvider).redeemPromoCode(code);
      ref.invalidate(walletProvider);
      HapticFeedback.mediumImpact();
      if (!mounted) return;

      final credited = updated.balanceMinor - previousBalance;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const SuccessCheckmark(),
          content: Text(
            l10n.promoCodeSuccessMessage(
              formatMoney(credited, updated.currency, localeName),
            ),
            textAlign: TextAlign.center,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(l10n.commonClose),
            ),
          ],
        ),
      );
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      final failure = Failure.from(error);
      setState(() {
        _errorMessage = switch (failure.code) {
          'PROMO_CODE_ALREADY_REDEEMED' => l10n.promoCodeAlreadyRedeemed,
          'NOT_FOUND' => l10n.promoCodeInvalid,
          _ => failure.message,
        };
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.lg),
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          Text(l10n.promoCodeSheetTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _controller,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _activate(),
            decoration: InputDecoration(
              labelText: l10n.promoCodeInputLabel,
              hintText: l10n.promoCodeInputHint,
              prefixIcon: const Icon(Icons.confirmation_number_outlined),
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
            onPressed: _submitting ? null : _activate,
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.promoCodeActivateButton),
          ),
        ],
      ),
    );
  }
}
