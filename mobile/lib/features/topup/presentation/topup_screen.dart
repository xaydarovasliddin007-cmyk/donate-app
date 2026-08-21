import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/success_checkmark.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../wallet/application/wallet_providers.dart';
import '../application/topup_providers.dart';
import '../domain/receiving_method.dart';

/// Major-unit UZS presets — common round top-up amounts, so most users never
/// have to type anything.
const _presetAmounts = [50000, 100000, 200000, 500000, 1000000];

class TopupScreen extends ConsumerStatefulWidget {
  const TopupScreen({super.key});

  @override
  ConsumerState<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends ConsumerState<TopupScreen> {
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  String? _selectedMethodId;
  int? _selectedPreset;
  bool _submitting = false;
  String? _errorMessage;

  void _pickPreset(int amount) {
    setState(() {
      _selectedPreset = amount;
      _amountController.text = amount.toString();
      _errorMessage = null;
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _submit(List<ReceivingMethod> methods) async {
    final l10n = AppLocalizations.of(context);
    final amountMajor = double.tryParse(_amountController.text.trim());
    if (amountMajor == null || amountMajor <= 0) {
      setState(() => _errorMessage = l10n.topupValidationError);
      return;
    }
    if (_selectedMethodId == null) {
      setState(() => _errorMessage = l10n.topupSelectMethodTitle);
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      await ref
          .read(topupApiProvider)
          .createTopUpRequest(
            receivingMethodId: _selectedMethodId!,
            amountMinor: (amountMajor * 100).round(),
            userReference: _referenceController.text.trim().isEmpty
                ? null
                : _referenceController.text.trim(),
          );
      ref.invalidate(walletProvider);

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const SuccessCheckmark(),
          title: Text(l10n.topupSuccessTitle),
          content: Text(l10n.topupSuccessMessage),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonClose),
            ),
          ],
        ),
      );
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      final failure = Failure.from(error);
      setState(() {
        _errorMessage = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : failure.message;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final methodsAsync = ref.watch(receivingMethodsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.topupTitle)),
      body: SafeArea(
        child: methodsAsync.when(
          loading: () => const LoadingView(),
          error: (error, _) {
            final failure = Failure.from(error);
            return ErrorView(
              title: failure.isNetworkError
                  ? l10n.errorNoConnectionTitle
                  : l10n.errorGenericTitle,
              message: failure.isNetworkError
                  ? l10n.errorNoConnectionMessage
                  : l10n.errorGenericMessage,
              retryLabel: l10n.commonRetry,
              onRetry: () => ref.invalidate(receivingMethodsProvider),
            );
          },
          data: (methods) {
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                Text(l10n.topupAmountLabel, style: theme.textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: false,
                  ),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  decoration: InputDecoration(
                    hintText: l10n.topupAmountHint,
                    suffixText: 'UZS',
                  ),
                  onChanged: (_) => setState(() => _selectedPreset = null),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final preset in _presetAmounts)
                      ChoiceChip(
                        label: Text(
                          formatMoney(
                            preset * 100,
                            'UZS',
                            Localizations.localeOf(context).toString(),
                          ),
                        ),
                        selected: _selectedPreset == preset,
                        onSelected: (_) => _pickPreset(preset),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  l10n.topupSelectMethodTitle,
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.sm,
                    crossAxisSpacing: AppSpacing.sm,
                    childAspectRatio: 1.55,
                  ),
                  itemCount: methods.length,
                  itemBuilder: (context, index) {
                    final method = methods[index];
                    return _ReceivingMethodTile(
                      method: method,
                      selected: _selectedMethodId == method.id,
                      onTap: () => setState(() {
                        _selectedMethodId = method.id;
                        _errorMessage = null;
                      }),
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: _referenceController,
                  decoration: InputDecoration(
                    labelText: l10n.topupUserReferenceLabel,
                    hintText: l10n.topupUserReferenceHint,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest.withValues(
                      alpha: 0.5,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.topupInstructionsTitle,
                        style: theme.textTheme.titleSmall,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        l10n.topupInstructions,
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
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
                  onPressed: _submitting ? null : () => _submit(methods),
                  child: _submitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.topupSubmitButton),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// A payment method rendered as a miniature bank-card mockup — gradient
/// face, masked number, cardholder/bank — rather than a plain list row with
/// a leading radio button. Selection is shown with a bright border ring and
/// a checkmark badge instead of the radio icon.
class _ReceivingMethodTile extends StatelessWidget {
  const _ReceivingMethodTile({
    required this.method,
    required this.selected,
    required this.onTap,
  });

  final ReceivingMethod method;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gradient =
        AppColors.tileGradients[method.id.hashCode.abs() %
            AppColors.tileGradients.length];

    return PressableScale(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected ? Colors.white : Colors.transparent,
            width: selected ? 2 : 0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.credit_card_rounded,
                  color: Colors.white70,
                  size: 20,
                ),
                const Spacer(),
                if (selected)
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check_rounded,
                      size: 12,
                      color: gradient.first,
                    ),
                  ),
              ],
            ),
            const Spacer(),
            Text(
              method.cardNumberMasked,
              style: theme.textTheme.titleSmall?.copyWith(
                color: Colors.white,
                letterSpacing: 0.5,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              method.bankName != null
                  ? '${method.cardHolderName} · ${method.bankName}'
                  : method.cardHolderName,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
