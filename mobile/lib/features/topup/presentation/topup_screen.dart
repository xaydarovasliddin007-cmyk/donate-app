import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/copied_toast.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/selectable_chip.dart';
import '../../../core/widgets/success_checkmark.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../wallet/application/wallet_providers.dart';
import '../application/topup_providers.dart';
import '../domain/receiving_method.dart';
import '../domain/top_up_request.dart';

/// Major-unit UZS presets — common round top-up amounts, so most users never
/// have to type anything.
const _presetAmounts = [50000, 100000, 200000, 500000, 1000000];

const _pollInterval = Duration(seconds: 4);

class TopupScreen extends ConsumerStatefulWidget {
  const TopupScreen({super.key});

  @override
  ConsumerState<TopupScreen> createState() => _TopupScreenState();
}

class _TopupScreenState extends ConsumerState<TopupScreen> {
  final _amountController = TextEditingController();
  int? _selectedPreset;
  bool _submitting = false;
  String? _errorMessage;

  // Once set, the screen shows the assigned card + countdown instead of the
  // amount-entry form — this is the "you've been given exactly one card"
  // step of the automatic card-transfer flow.
  TopUpRequest? _reservation;
  Timer? _pollTimer;
  Timer? _countdownTimer;
  Duration? _remaining;

  // Set (to more than one type) only when more than one receiving-method
  // type is currently active — the method-type picker step. Skipped
  // entirely when zero or one type is active, so today's card-only setup
  // behaves exactly as before.
  List<ReceivingMethodType>? _availableTypes;

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
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _onContinue() async {
    final l10n = AppLocalizations.of(context);
    final amountMajor = double.tryParse(_amountController.text.trim());
    if (amountMajor == null || amountMajor <= 0) {
      setState(() => _errorMessage = l10n.topupValidationError);
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      final methods = await ref.read(topupApiProvider).listReceivingMethods();
      final types = methods.map((m) => m.type).toSet().toList();
      if (!mounted) return;
      if (types.length > 1) {
        setState(() {
          _submitting = false;
          _availableTypes = types;
        });
      } else {
        await _reserve(types.isEmpty ? null : types.first);
      }
    } catch (error) {
      final failure = Failure.from(error);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorMessage = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : failure.message;
      });
    }
  }

  Future<void> _reserve(ReceivingMethodType? type) async {
    final l10n = AppLocalizations.of(context);
    final amountMajor = double.tryParse(_amountController.text.trim())!;

    setState(() {
      _submitting = true;
      _errorMessage = null;
    });

    try {
      final reservation = await ref
          .read(topupApiProvider)
          .reserveTopUp(amountMinor: (amountMajor * 100).round(), type: type);
      if (!mounted) return;
      setState(() {
        _reservation = reservation;
        _availableTypes = null;
        _submitting = false;
      });
      _startCountdown(reservation.expiresAt);
      _startPolling(reservation.id);
    } catch (error) {
      final failure = Failure.from(error);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorMessage = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : failure.message;
      });
    }
  }

  void _startCountdown(DateTime? expiresAt) {
    _countdownTimer?.cancel();
    if (expiresAt == null) return;
    void tick() {
      final left = expiresAt.difference(DateTime.now());
      if (!mounted) return;
      setState(() => _remaining = left.isNegative ? Duration.zero : left);
    }

    tick();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  void _startPolling(String requestId) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) async {
      try {
        final updated = await ref.read(topupApiProvider).getTopUp(requestId);
        if (!mounted) return;
        if (updated.status == TopUpRequestStatus.verified) {
          _pollTimer?.cancel();
          _countdownTimer?.cancel();
          setState(() => _reservation = updated);
          await _showSuccess();
        } else if (updated.status != TopUpRequestStatus.pending) {
          _pollTimer?.cancel();
          _countdownTimer?.cancel();
          setState(() => _reservation = updated);
        }
      } catch (_) {
        // Transient network hiccup — the next tick just tries again.
      }
    });
  }

  Future<void> _showSuccess() async {
    final l10n = AppLocalizations.of(context);
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
  }

  void _reset() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    setState(() {
      _reservation = null;
      _availableTypes = null;
      _remaining = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final Widget body;
    if (_reservation != null) {
      body = _ReservationView(
        reservation: _reservation!,
        remaining: _remaining,
        onTryAgain: _reset,
      );
    } else if (_availableTypes != null) {
      body = _MethodPickerView(
        types: _availableTypes!,
        submitting: _submitting,
        errorMessage: _errorMessage,
        onPickType: _reserve,
        onBack: () => setState(() => _availableTypes = null),
      );
    } else {
      body = _AmountEntryView(
        amountController: _amountController,
        selectedPreset: _selectedPreset,
        submitting: _submitting,
        errorMessage: _errorMessage,
        onPickPreset: _pickPreset,
        onAmountChanged: () => setState(() => _errorMessage = null),
        onSubmit: _onContinue,
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.topupTitle)),
      body: SafeArea(child: body),
    );
  }
}

class _AmountEntryView extends StatelessWidget {
  const _AmountEntryView({
    required this.amountController,
    required this.selectedPreset,
    required this.submitting,
    required this.errorMessage,
    required this.onPickPreset,
    required this.onAmountChanged,
    required this.onSubmit,
  });

  final TextEditingController amountController;
  final int? selectedPreset;
  final bool submitting;
  final String? errorMessage;
  final ValueChanged<int> onPickPreset;
  final VoidCallback onAmountChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

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
          // Explained up front, before the form — the point raised was that
          // users don't clearly understand how a top-up actually reaches
          // their balance, so this leads the screen instead of being a
          // small paragraph buried under the submit button.
          const _HowItWorksCard(),
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.topupAmountLabel, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          _AmountField(
            controller: amountController,
            onChanged: onAmountChanged,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final preset in _presetAmounts)
                SelectableChip(
                  label: formatMoney(
                    preset * 100,
                    'UZS',
                    Localizations.localeOf(context).toString(),
                  ),
                  selected: selectedPreset == preset,
                  onTap: () => onPickPreset(preset),
                ),
            ],
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              errorMessage!,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: submitting ? null : onSubmit,
            child: submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.topupContinueButton),
          ),
        ],
      ),
    );
  }
}

/// The method-type picker — shown only when more than one receiving-method
/// type is currently active, letting the user choose how they want to pay
/// before an amount is reserved against that type.
class _MethodPickerView extends StatelessWidget {
  const _MethodPickerView({
    required this.types,
    required this.submitting,
    required this.errorMessage,
    required this.onPickType,
    required this.onBack,
  });

  final List<ReceivingMethodType> types;
  final bool submitting;
  final String? errorMessage;
  final ValueChanged<ReceivingMethodType> onPickType;
  final VoidCallback onBack;

  static const _icons = {
    ReceivingMethodType.cardTransfer: Icons.credit_card_rounded,
    ReceivingMethodType.qrCode: Icons.qr_code_2_rounded,
    ReceivingMethodType.paynetTerminal: Icons.receipt_long_rounded,
  };

  String _labelOf(AppLocalizations l10n, ReceivingMethodType type) =>
      switch (type) {
        ReceivingMethodType.cardTransfer => l10n.topupMethodCardTransfer,
        ReceivingMethodType.qrCode => l10n.topupMethodQrCode,
        ReceivingMethodType.paynetTerminal => l10n.topupMethodPaynetTerminal,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: submitting ? null : onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            Text(l10n.topupSelectMethodTitle, style: theme.textTheme.titleMedium),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        for (final type in types) ...[
          _MethodOptionTile(
            icon: _icons[type]!,
            label: _labelOf(l10n, type),
            enabled: !submitting,
            onTap: () => onPickType(type),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (submitting) ...[
          const SizedBox(height: AppSpacing.md),
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ],
        if (errorMessage != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            errorMessage!,
            style: TextStyle(color: theme.colorScheme.error),
          ),
        ],
      ],
    );
  }
}

class _MethodOptionTile extends StatelessWidget {
  const _MethodOptionTile({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PressableScale(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: theme.colorScheme.onPrimaryContainer),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: theme.colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

/// The "here are all the cards, transfer to any of them" step: lists every
/// active receiving card, the exact amount to transfer, a live countdown
/// until the reservation expires, an "I've paid" acknowledgment the user
/// can tap for reassurance, and the current status while the app polls in
/// the background. Tapping "I've paid" never credits anything by itself —
/// only a matching bank transaction (or a manual admin review) does that;
/// it just switches the waiting copy to something less generic.
class _ReservationView extends ConsumerStatefulWidget {
  const _ReservationView({
    required this.reservation,
    required this.remaining,
    required this.onTryAgain,
  });

  final TopUpRequest reservation;
  final Duration? remaining;
  final VoidCallback onTryAgain;

  @override
  ConsumerState<_ReservationView> createState() => _ReservationViewState();
}

class _ReservationViewState extends ConsumerState<_ReservationView> {
  String? _selectedMethodId;
  bool _confirmedPaid = false;

  final _referenceController = TextEditingController();
  bool _submittingReference = false;
  String? _referenceError;

  @override
  void dispose() {
    _referenceController.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  Future<void> _submitReceipt() async {
    final l10n = AppLocalizations.of(context);
    final value = _referenceController.text.trim();
    if (value.isEmpty) {
      setState(() => _referenceError = l10n.topupReceiptRequiredError);
      return;
    }
    setState(() {
      _submittingReference = true;
      _referenceError = null;
    });
    try {
      await ref.read(topupApiProvider).submitReference(widget.reservation.id, value);
      if (!mounted) return;
      setState(() {
        _confirmedPaid = true;
        _submittingReference = false;
      });
    } catch (error) {
      final failure = Failure.from(error);
      if (!mounted) return;
      setState(() {
        _submittingReference = false;
        _referenceError = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : failure.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final reduceMotion = ref.watch(reduceMotionProvider);
    final reservation = widget.reservation;
    final remaining = widget.remaining;
    final methods =
        reservation.receivingMethods ??
        (reservation.receivingMethod != null
            ? [reservation.receivingMethod!]
            : const []);
    final type = methods.isNotEmpty
        ? methods.first.type
        : ReceivingMethodType.cardTransfer;
    final isExpired =
        reservation.status == TopUpRequestStatus.expired ||
        (remaining != null && remaining <= Duration.zero);
    final isRejected = reservation.status == TopUpRequestStatus.rejected;
    final isDone = isExpired || isRejected;

    return TweenAnimationBuilder<double>(
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
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          if (type == ReceivingMethodType.cardTransfer) ...[
            Text(l10n.topupReservedCardTitle, style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  Icons.verified_rounded,
                  size: 14,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 4),
                Text(
                  l10n.topupNoCommissionNote,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            for (final method in methods)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _ReceivingMethodTile(
                  method: method,
                  selected: (_selectedMethodId ?? methods.first.id) == method.id,
                  onTap: () => setState(() => _selectedMethodId = method.id),
                  onCopy: () {
                    Clipboard.setData(ClipboardData(text: method.cardNumber ?? ''));
                    showCopiedToast(
                      context,
                      message: l10n.topupCardNumberCopied,
                      reduceMotion: reduceMotion,
                    );
                  },
                ),
              ),
          ] else ...[
            Text(
              type == ReceivingMethodType.qrCode
                  ? l10n.topupMethodQrCode
                  : l10n.topupMethodPaynetTerminal,
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              type == ReceivingMethodType.qrCode
                  ? l10n.topupQrInstructions
                  : l10n.topupTerminalInstructions,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            if (methods.isNotEmpty && methods.first.qrPayload != null)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: QrImageView(
                    data: methods.first.qrPayload!,
                    size: 220,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.errorContainer.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(
                color: theme.colorScheme.error.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.error_rounded,
                  size: 18,
                  color: theme.colorScheme.error,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    l10n.topupExactAmountWarning,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest.withValues(
                alpha: 0.5,
              ),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.topupExactAmountLabel,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        formatExactAmount(
                          reservation.amountMinor,
                          reservation.currency,
                          locale,
                        ),
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: l10n.commonCopy,
                      icon: const Icon(Icons.copy_rounded),
                      onPressed: () {
                        Clipboard.setData(
                          ClipboardData(
                            text: exactAmountCopyValue(reservation.amountMinor),
                          ),
                        );
                        showCopiedToast(
                          context,
                          message: l10n.topupAmountCopied,
                          reduceMotion: reduceMotion,
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (!isDone) ...[
            if (remaining != null)
              Center(
                child: Text(
                  l10n.topupTimeLeftLabel(_formatDuration(remaining)),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: remaining.inMinutes < 2
                        ? theme.colorScheme.error
                        : theme.colorScheme.onSurface,
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.md),
            if (!_confirmedPaid) ...[
              if (type == ReceivingMethodType.paynetTerminal) ...[
                TextField(
                  controller: _referenceController,
                  decoration: InputDecoration(
                    labelText: l10n.topupReceiptNumberLabel,
                    hintText: l10n.topupReceiptNumberHint,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                  onChanged: (_) {
                    if (_referenceError != null) {
                      setState(() => _referenceError = null);
                    }
                  },
                ),
                if (_referenceError != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _referenceError!,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: _submittingReference ? null : _submitReceipt,
                  icon: _submittingReference
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                  label: Text(l10n.topupSubmitReceiptButton),
                ),
              ] else ...[
                FilledButton.icon(
                  onPressed: () => setState(() => _confirmedPaid = true),
                  icon: const Icon(Icons.check_circle_outline_rounded),
                  label: Text(l10n.topupIvePaidButton),
                ),
                const SizedBox(height: AppSpacing.sm),
                Center(
                  child: Text(
                    l10n.topupWaitingMessage,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ] else
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      type == ReceivingMethodType.paynetTerminal
                          ? l10n.topupReceiptSubmittedMessage
                          : l10n.topupCheckingMessage,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
          ] else ...[
            Center(
              child: Column(
                children: [
                  Icon(
                    Icons.timer_off_rounded,
                    size: 40,
                    color: theme.colorScheme.error,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    l10n.topupExpiredTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.topupExpiredMessage,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          if (isDone)
            FilledButton(
              onPressed: widget.onTryAgain,
              child: Text(l10n.topupTryAgainButton),
            )
          else
            TextButton(
              onPressed: widget.onTryAgain,
              child: Text(l10n.topupCancelReservationButton),
            ),
        ],
      ),
    );
  }
}

/// Bigger, bolder amount entry — the screen's primary input deserves more
/// visual weight than a default-styled [TextField].
class _AmountField extends StatelessWidget {
  const _AmountField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

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
        onChanged: (_) => onChanged(),
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

/// Numbered, iconed walkthrough of the automatic card-transfer top-up
/// process — leads the screen so the "why am I being given a card, and what
/// happens after I pay" questions are answered before the user types
/// anything.
class _HowItWorksCard extends ConsumerWidget {
  const _HowItWorksCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);
    final steps = [
      (Icons.edit_rounded, l10n.topupStep1Title, l10n.topupStep1Message),
      (Icons.credit_card_rounded, l10n.topupStep2Title, l10n.topupStep2Message),
      (Icons.bolt_rounded, l10n.topupStep3Title, l10n.topupStep3Message),
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
/// face, chip glyph, masked number, cardholder/bank, and a card-network-style
/// flourish — rather than a plain list row.
class _ReceivingMethodTile extends StatelessWidget {
  const _ReceivingMethodTile({
    required this.method,
    required this.selected,
    required this.onTap,
    this.onCopy,
  });

  final ReceivingMethod method;
  final bool selected;
  final VoidCallback? onTap;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gradient =
        AppColors.tileGradients[method.id.hashCode.abs() %
            AppColors.tileGradients.length];

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(20),
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
        child: Stack(
          children: [
            // A generic dual-ring flourish in the corner — reads as "this is
            // a card" the way a network mark would, without mimicking any
            // real card network's actual logo.
            Positioned(
              right: -16,
              bottom: -16,
              child: Row(
                children: [
                  _NetworkRing(color: Colors.white.withValues(alpha: 0.14)),
                  Transform.translate(
                    offset: const Offset(-18, 0),
                    child: _NetworkRing(
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _CardChipIcon(),
                      const Spacer(),
                      AnimatedSwitcher(
                        duration: AppMotion.fast,
                        child: selected
                            ? Container(
                                key: const ValueKey(true),
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
                              )
                            : _BankBadge(
                                key: const ValueKey(false),
                                bankName: method.bankName,
                              ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          method.cardNumber ?? '',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            letterSpacing: 1.4,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (onCopy != null)
                        InkWell(
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          onTap: onCopy,
                          child: const Padding(
                            padding: EdgeInsets.all(4),
                            child: Icon(
                              Icons.copy_rounded,
                              size: 16,
                              color: Colors.white70,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    method.bankName != null
                        ? '${method.cardHolderName} · ${method.bankName}'
                        : method.cardHolderName,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white70,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The little gold contact-pad glyph every physical bank card has — sells
/// the "this is a card" read at a glance, independent of any card network.
class _CardChipIcon extends StatelessWidget {
  const _CardChipIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26,
      height: 19,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFE8B0), AppColors.brandWarm],
        ),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.black.withValues(alpha: 0.12)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(
          2,
          (_) => Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            color: Colors.black.withValues(alpha: 0.18),
          ),
        ),
      ),
    );
  }
}

/// A compact circular badge holding the bank's initials — a stand-in for a
/// real bank logo (none is on file) that still reads as "this card belongs
/// to a specific bank" rather than a generic credit-card icon.
class _BankBadge extends StatelessWidget {
  const _BankBadge({super.key, required this.bankName});

  final String? bankName;

  @override
  Widget build(BuildContext context) {
    final initials = _initialsOf(bankName);
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        shape: BoxShape.circle,
      ),
      child: initials != null
          ? Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            )
          : const Icon(
              Icons.account_balance_rounded,
              size: 13,
              color: Colors.white,
            ),
    );
  }

  static String? _initialsOf(String? bankName) {
    if (bankName == null || bankName.trim().isEmpty) return null;
    final words = bankName.trim().split(RegExp(r'\s+'));
    final letters = words.take(2).map((w) => w[0].toUpperCase()).join();
    return letters;
  }
}

class _NetworkRing extends StatelessWidget {
  const _NetworkRing({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
