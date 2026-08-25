import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/staggered_entrance.dart';
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
            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: AppMotion.entrance,
              curve: AppMotion.standard,
              builder: (context, t, child) => Opacity(
                opacity: t,
                child: Transform.translate(
                  offset: Offset(0, (1 - t) * 12),
                  child: child,
                ),
              ),
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  // Explained up front, before the form — the point raised was
                  // that users don't clearly understand how a top-up actually
                  // reaches their balance, so this leads the screen instead of
                  // being a small paragraph buried under the submit button.
                  const _HowItWorksCard(),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    l10n.topupAmountLabel,
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _AmountField(controller: _amountController),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final preset in _presetAmounts)
                        _PresetChip(
                          label: formatMoney(
                            preset * 100,
                            'UZS',
                            Localizations.localeOf(context).toString(),
                          ),
                          selected: _selectedPreset == preset,
                          onTap: () => _pickPreset(preset),
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
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: AppSpacing.sm,
                          crossAxisSpacing: AppSpacing.sm,
                          childAspectRatio: 1.55,
                        ),
                    itemCount: methods.length,
                    itemBuilder: (context, index) {
                      final method = methods[index];
                      return StaggeredEntrance(
                        index: index,
                        child: _ReceivingMethodTile(
                          method: method,
                          selected: _selectedMethodId == method.id,
                          onTap: () => setState(() {
                            _selectedMethodId = method.id;
                            _errorMessage = null;
                          }),
                        ),
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
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Bigger, bolder amount entry — the screen's primary input deserves more
/// visual weight than a default-styled [TextField].
class _AmountField extends StatelessWidget {
  const _AmountField({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 4,
      ),
      child: TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: false),
        style: theme.textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
        ),
        decoration: InputDecoration(
          hintText: l10n.topupAmountHint,
          suffixText: 'UZS',
          suffixStyle: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          border: InputBorder.none,
        ),
      ),
    );
  }
}

class _PresetChip extends StatelessWidget {
  const _PresetChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return PressableScale(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: AnimatedContainer(
        duration: AppMotion.fast,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          gradient: selected ? LinearGradient(colors: gradient) : null,
          color: selected
              ? null
              : theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.6,
                ),
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: selected
              ? null
              : Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: selected ? Colors.white : theme.colorScheme.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// Numbered, iconed walkthrough of the manual top-up process — leads the
/// screen so the "why do I transfer money and then wait" question is
/// answered before the user fills in anything.
class _HowItWorksCard extends ConsumerWidget {
  const _HowItWorksCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);
    final steps = [
      (Icons.credit_card_rounded, l10n.topupStep1Title, l10n.topupStep1Message),
      (Icons.task_alt_rounded, l10n.topupStep2Title, l10n.topupStep2Message),
      (
        Icons.hourglass_top_rounded,
        l10n.topupStep3Title,
        l10n.topupStep3Message,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.topupInstructionsTitle, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < steps.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: reduceMotion
                  ? Duration.zero
                  : AppMotion.fast + Duration(milliseconds: i * 90),
              curve: AppMotion.standard,
              builder: (context, t, child) => Opacity(
                opacity: t,
                child: Transform.translate(
                  offset: Offset((1 - t) * -8, 0),
                  child: child,
                ),
              ),
              child: _StepRow(
                number: i + 1,
                icon: steps[i].$1,
                title: steps[i].$2,
                message: steps[i].$3,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({
    required this.number,
    required this.icon,
    required this.title,
    required this.message,
  });

  final int number;
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 16,
            color: theme.colorScheme.onPrimaryContainer,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$number. $title',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                message,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
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
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: gradient.first.withValues(alpha: 0.45),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
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
