import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/errors/failure.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/success_checkmark.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../wallet/application/wallet_providers.dart';
import '../../application/topup_providers.dart';
import '../../domain/receiving_method.dart';
import '../../domain/top_up_request.dart';
import '../topup_screen.dart' show TopUpReservationView;

/// Opens the in-checkout top-up sheet: same reservation flow as the full
/// `/wallet/topup` screen (card list / QR / countdown / polling), but as a
/// modal over whatever screen called it instead of a route push — so
/// checkout's own state (player ID, product, selected payment method)
/// never unmounts while the user tops up. Returns `true` once the top-up is
/// verified and the sheet has been dismissed by the user continuing.
Future<bool?> showTopUpBottomSheet(
  BuildContext context, {
  required int shortfallMinor,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => TopUpBottomSheet(shortfallMinor: shortfallMinor),
  );
}

class TopUpBottomSheet extends ConsumerStatefulWidget {
  const TopUpBottomSheet({super.key, required this.shortfallMinor});

  /// The amount still missing to afford the pending purchase — pre-fills
  /// the amount field (rounded up to a clean number) so most users never
  /// have to type anything, matching the full top-up screen's presets.
  final int shortfallMinor;

  @override
  ConsumerState<TopUpBottomSheet> createState() => _TopUpBottomSheetState();
}

class _TopUpBottomSheetState extends ConsumerState<TopUpBottomSheet> {
  late final _amountController = TextEditingController(
    text: _roundedUpMajorUnits(widget.shortfallMinor).toString(),
  );
  bool _submitting = false;
  String? _errorMessage;
  TopUpRequest? _reservation;
  bool _verified = false;
  Timer? _pollTimer;
  Timer? _countdownTimer;
  Duration? _remaining;

  /// Rounds the shortfall up to the nearest 1 000 so the pre-filled amount
  /// is a clean number to transfer, not e.g. "14 231".
  static int _roundedUpMajorUnits(int shortfallMinor) {
    final major = (shortfallMinor / 100).ceil();
    const step = 1000;
    return ((major + step - 1) ~/ step) * step;
  }

  @override
  void dispose() {
    _amountController.dispose();
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _reserve() async {
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
      // Card-transfer-only here (no method picker) — the sheet is a fast
      // path for "I'm mid-purchase and just need a bit more." Card transfer
      // is always active in practice; if it's ever the only method turned
      // off, this reserve call fails with "no receiving methods configured"
      // (see TopupScreen for the full method-then-amount picker).
      final reservation = await ref
          .read(topupApiProvider)
          .reserveTopUp(
            amountMinor: (amountMajor * 100).round(),
            type: ReceivingMethodType.cardTransfer,
          );
      if (!mounted) return;
      setState(() {
        _reservation = reservation;
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
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      try {
        final updated = await ref.read(topupApiProvider).getTopUp(requestId);
        if (!mounted) return;
        if (updated.status == TopUpRequestStatus.verified) {
          _pollTimer?.cancel();
          _countdownTimer?.cancel();
          ref.invalidate(walletProvider);
          setState(() {
            _reservation = updated;
            _verified = true;
          });
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

  void _reset() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    setState(() {
      _reservation = null;
      _remaining = null;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final viewInsets = MediaQuery.of(context).viewInsets;

    return AnimatedPadding(
      duration: AppMotion.fast,
      padding: EdgeInsets.only(bottom: viewInsets.bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: AnimatedSize(
            duration: AppMotion.medium,
            curve: AppMotion.standard,
            alignment: Alignment.topCenter,
            child: _verified
                ? _SuccessBody(
                    onContinue: () => Navigator.of(context).pop(true),
                  )
                : _reservation != null
                ? SizedBox(
                    height: MediaQuery.of(context).size.height * 0.72,
                    child: TopUpReservationView(
                      reservation: _reservation!,
                      remaining: _remaining,
                      onTryAgain: _reset,
                    ),
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 36,
                          height: 4,
                          margin: const EdgeInsets.only(
                            bottom: AppSpacing.md,
                          ),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.outlineVariant,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                        ),
                      ),
                      Text(l10n.topupSheetTitle, style: theme.textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        l10n.topupSheetShortfallLabel(
                          formatMoney(widget.shortfallMinor, 'UZS', localeName),
                        ),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(l10n.topupAmountLabel, style: theme.textTheme.titleSmall),
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surfaceContainerHighest
                              .withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          border: Border.all(
                            color: theme.colorScheme.outlineVariant,
                          ),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: 4,
                        ),
                        child: TextField(
                          controller: _amountController,
                          autofocus: true,
                          onChanged: (_) {
                            if (_errorMessage != null) {
                              setState(() => _errorMessage = null);
                            }
                          },
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: false,
                          ),
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
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          _errorMessage!,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      FilledButton(
                        onPressed: _submitting ? null : _reserve,
                        child: _submitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(l10n.topupContinueButton),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SuccessCheckmark(size: 56),
        const SizedBox(height: AppSpacing.md),
        Text(
          l10n.topupSuccessTitle,
          style: theme.textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          l10n.topupSheetSuccessMessage,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(
          onPressed: onContinue,
          child: Text(l10n.topupSheetContinueButton),
        ),
      ],
    );
  }
}
