import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
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

/// Every valid EMVCo Merchant Presented QR payload starts with tag "00"
/// (Payload Format Indicator), length "02", value "01" — i.e. the literal
/// substring "000201". A bank app's own "pay by QR" scanner expects to see
/// that from byte zero and rejects anything else (a URL, in particular) as
/// an invalid QR, even though the same bytes are present a little further
/// in. Stored receiving-method payloads sometimes come as a
/// "https://app.paynet.uz/qr-online/000201..." link instead of the raw
/// string — this strips down to the raw EMV payload the QR image should
/// actually encode, regardless of which form was pasted into the admin
/// panel. A no-op if the payload is already raw.
String _emvPayloadOf(String raw) {
  final start = raw.indexOf('000201');
  return start <= 0 ? raw : raw.substring(start);
}

/// One row in the method picker. [type] is what actually gets sent to
/// [TopupApi.reserveTopUp] — Humo and Uzcard both submit
/// [ReceivingMethodType.cardTransfer] and land on the exact same card list,
/// since a card-to-card transfer reaches the same recipient card over
/// NBU's interbank rails no matter which network's app the payer used.
/// [key] (not [type]) is what the screen uses to remember which tile was
/// actually tapped, so the amount step's recap row can still say "Uzcard"
/// rather than always falling back to "Humo". Options with [type] null
/// (Visa, USDT) are purely decorative "coming soon" rows — there's no
/// backend support for them yet, so they're never tappable.
class _PaymentOption {
  const _PaymentOption({
    required this.key,
    required this.logo,
    required this.title,
    required this.subtitle,
    this.type,
  });

  final String key;
  final Widget logo;
  final String title;
  final String subtitle;
  final ReceivingMethodType? type;

  bool get enabled => type != null;
}

/// Builds the flattened, data-driven option list. Humo/Uzcard/Paynet
/// terminal all show up together, or not at all, based on whether any
/// CARD_TRANSFER method is active — the terminal option has no receiving
/// data of its own (see reserveTopUpRequest's doc comment on the backend),
/// so there's nothing to check for it independently.
List<_PaymentOption> _paymentOptionsOf(
  AppLocalizations l10n,
  List<ReceivingMethod> methods,
) {
  final options = <_PaymentOption>[];

  final hasCards = methods.any(
    (m) => m.type == ReceivingMethodType.cardTransfer,
  );
  if (hasCards) {
    options.add(
      _PaymentOption(
        key: 'humo',
        logo: const _AssetLogoBadge(
          assetPath: 'assets/payment_logos/humo.png',
          isSvg: false,
        ),
        title: 'Humo',
        subtitle: l10n.topupSubtitleCardTransfer,
        type: ReceivingMethodType.cardTransfer,
      ),
    );
    options.add(
      _PaymentOption(
        key: 'uzcard',
        logo: const _AssetLogoBadge(
          assetPath: 'assets/payment_logos/uzcard.svg',
          background: Color(0xFFFF5C00),
        ),
        title: 'Uzcard',
        subtitle: l10n.topupSubtitleCardTransfer,
        type: ReceivingMethodType.cardTransfer,
      ),
    );
  }
  if (methods.any((m) => m.type == ReceivingMethodType.qrCode)) {
    options.add(
      _PaymentOption(
        key: 'qr',
        logo: const _IconLogoBadge(
          icon: Icons.qr_code_2_rounded,
          color: AppColors.brandPrimary,
        ),
        title: l10n.topupMethodQrCode,
        subtitle: l10n.topupSubtitleQrCode,
        type: ReceivingMethodType.qrCode,
      ),
    );
  }
  if (hasCards) {
    options.add(
      _PaymentOption(
        key: 'terminal',
        logo: const _IconLogoBadge(
          icon: Icons.receipt_long_rounded,
          color: AppColors.brandWarm,
        ),
        title: l10n.topupMethodPaynetTerminal,
        subtitle: l10n.topupSubtitlePaynetTerminal,
        type: ReceivingMethodType.paynetTerminal,
      ),
    );
  }
  // Always-shown, always-disabled — honestly labeled "coming soon" rather
  // than hidden, since the reference layout this was modeled on always
  // shows every payment brand it supports, active or not.
  options.add(
    _PaymentOption(
      key: 'visa',
      logo: const _AssetLogoBadge(assetPath: 'assets/payment_logos/visa.svg'),
      title: 'Visa',
      subtitle: l10n.topupSubtitleInternational,
    ),
  );
  options.add(
    _PaymentOption(
      key: 'usdt',
      logo: const _AssetLogoBadge(
        assetPath: 'assets/payment_logos/tether.svg',
      ),
      title: 'USDT (BEP20)',
      subtitle: l10n.topupSubtitleCrypto,
    ),
  );
  return options;
}

/// Fixed-footprint badge every payment-method row uses, so a wordmark-shaped
/// logo (Uzcard, Visa) and a squarer one (the Humo card mockup) sit at the
/// same visual weight without either being cropped.
class _AssetLogoBadge extends StatelessWidget {
  const _AssetLogoBadge({
    required this.assetPath,
    this.isSvg = true,
    this.background,
  });

  final String assetPath;
  final bool isSvg;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: 56,
      height: 44,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: background ?? theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: isSvg
          ? SvgPicture.asset(assetPath, fit: BoxFit.contain)
          // Width only, not both — cacheHeight alongside it would force an
          // exact decode box and distort humo.png's non-square aspect ratio.
          : Image.asset(assetPath, fit: BoxFit.contain, cacheWidth: 168),
    );
  }
}

class _IconLogoBadge extends StatelessWidget {
  const _IconLogoBadge({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Icon(icon, color: color, size: 22),
    );
  }
}

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

  // Which tile in _paymentOptionsOf the user tapped. Null means "not chosen
  // yet." Keyed by _PaymentOption.key rather than its type, since Humo and
  // Uzcard share a type (both submit CARD_TRANSFER) but still need to be
  // told apart for the amount step's recap row.
  String? _selectedOptionKey;

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

  void _onAmountSubmit(ReceivingMethodType? type) {
    final l10n = AppLocalizations.of(context);
    final amountMajor = double.tryParse(_amountController.text.trim());
    if (amountMajor == null || amountMajor <= 0) {
      setState(() => _errorMessage = l10n.topupValidationError);
      return;
    }
    _reserve(type);
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

  // Keeps the chosen method (so cancelling/retrying a reservation returns to
  // the amount step, not all the way back to re-picking a method) — only the
  // reservation itself and the amount form's own error state reset.
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
    final methodsAsync = ref.watch(receivingMethodsProvider);

    Widget body;
    if (_reservation != null) {
      body = TopUpReservationView(
        reservation: _reservation!,
        remaining: _remaining,
        onTryAgain: _reset,
      );
    } else {
      body = methodsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _LoadMethodsError(
          message: Failure.from(error).isNetworkError
              ? l10n.errorNoConnectionMessage
              : Failure.from(error).message,
          onRetry: () => ref.invalidate(receivingMethodsProvider),
        ),
        data: (methods) {
          final options = _paymentOptionsOf(l10n, methods);
          // The method picker is always the first thing shown — per the
          // reference this was modeled on, "how do you want to pay" comes
          // before "how much," never the reverse.
          if (_selectedOptionKey == null) {
            return _MethodPickerView(
              options: options,
              onPick: (option) =>
                  setState(() => _selectedOptionKey = option.key),
            );
          }
          final selected = options.firstWhere(
            (o) => o.key == _selectedOptionKey,
            orElse: () => options.first,
          );
          return _AmountEntryView(
            amountController: _amountController,
            selectedPreset: _selectedPreset,
            submitting: _submitting,
            errorMessage: _errorMessage,
            onPickPreset: _pickPreset,
            onAmountChanged: () => setState(() => _errorMessage = null),
            onSubmit: () => _onAmountSubmit(selected.type),
            selectedOption: selected,
            onChangeMethod: () => setState(() => _selectedOptionKey = null),
          );
        },
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.topupTitle)),
      body: SafeArea(child: body),
    );
  }
}

class _LoadMethodsError extends StatelessWidget {
  const _LoadMethodsError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 40,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: onRetry,
              child: Text(l10n.topupTryAgainButton),
            ),
          ],
        ),
      ),
    );
  }
}

class _AmountEntryView extends ConsumerWidget {
  const _AmountEntryView({
    required this.amountController,
    required this.selectedPreset,
    required this.submitting,
    required this.errorMessage,
    required this.onPickPreset,
    required this.onAmountChanged,
    required this.onSubmit,
    required this.selectedOption,
    required this.onChangeMethod,
  });

  final TextEditingController amountController;
  final int? selectedPreset;
  final bool submitting;
  final String? errorMessage;
  final ValueChanged<int> onPickPreset;
  final VoidCallback onAmountChanged;
  final VoidCallback onSubmit;

  /// Which tile the user picked on the method screen — shown here as a
  /// small recap row so it's always visible which method the amount is
  /// about to be reserved against.
  final _PaymentOption selectedOption;

  /// Steps back to the method picker without leaving the screen.
  final VoidCallback onChangeMethod;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);

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
          PressableScale(
            onTap: onChangeMethod,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.5,
                ),
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: SizedBox(
                      width: 40,
                      height: 32,
                      child: FittedBox(child: selectedOption.logo),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      selectedOption.title,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    l10n.topupChangeMethodButton,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
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

/// The method picker — always the first screen of the top-up flow, so the
/// user commits to *how* they'll pay before typing an amount. Every active
/// method (and, for honesty, every announced-but-not-yet-active one) shows
/// here; nothing is hidden. A pure local selection — no network call
/// happens until the amount step submits (see
/// [_TopupScreenState._onAmountSubmit]), so there's nothing to fail here.
class _MethodPickerView extends ConsumerWidget {
  const _MethodPickerView({required this.options, required this.onPick});

  final List<_PaymentOption> options;
  final ValueChanged<_PaymentOption> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reduceMotion = ref.watch(reduceMotionProvider);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Text(l10n.topupSelectMethodTitle, style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.lg),
        for (var i = 0; i < options.length; i++) ...[
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: reduceMotion
                ? Duration.zero
                : AppMotion.fast + Duration(milliseconds: i * 60),
            curve: AppMotion.standard,
            builder: (context, t, child) => Opacity(
              opacity: t,
              child: Transform.translate(
                offset: Offset(0, (1 - t) * 10),
                child: child,
              ),
            ),
            child: _MethodOptionTile(
              option: options[i],
              onTap: () => onPick(options[i]),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _MethodOptionTile extends StatelessWidget {
  const _MethodOptionTile({required this.option, required this.onTap});

  final _PaymentOption option;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final enabled = option.enabled;

    return PressableScale(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        duration: AppMotion.fast,
        opacity: enabled ? 1 : 0.5,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHighest.withValues(
              alpha: 0.5,
            ),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Row(
            children: [
              option.logo,
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      option.title,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (option.subtitle.isNotEmpty)
                      Text(
                        option.subtitle,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              if (enabled)
                Icon(
                  Icons.chevron_right_rounded,
                  color: theme.colorScheme.onSurfaceVariant,
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    l10n.commonComingSoon,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
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

/// The "here are all the cards, transfer to any of them" step: lists every
/// active receiving card, the exact amount to transfer, a live countdown
/// until the reservation expires, an "I've paid" acknowledgment the user
/// can tap for reassurance, and the current status while the app polls in
/// the background. Tapping "I've paid" never credits anything by itself —
/// only a matching bank transaction (or a manual admin review) does that;
/// it just switches the waiting copy to something less generic.
///
/// Public (not file-private) because [TopUpBottomSheet] reuses it verbatim
/// for the in-checkout top-up flow — the reservation UI (card/QR list,
/// countdown, receipt field) is identical there, only who owns the
/// poll/countdown timers and what happens on success differs.
class TopUpReservationView extends ConsumerStatefulWidget {
  const TopUpReservationView({
    super.key,
    required this.reservation,
    required this.remaining,
    required this.onTryAgain,
  });

  final TopUpRequest reservation;
  final Duration? remaining;
  final VoidCallback onTryAgain;

  @override
  ConsumerState<TopUpReservationView> createState() => _TopUpReservationViewState();
}

class _TopUpReservationViewState extends ConsumerState<TopUpReservationView> {
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
            : const <ReceivingMethod>[]);
    // The request's own type, not the returned methods' type — for
    // PAYNET_TERMINAL those are ordinary CARD_TRANSFER rows (see
    // reserveTopUpRequest's doc comment on the backend), so only
    // reservation.type reliably says which UI to render. Falls back to the
    // methods' type for requests made before this field existed.
    final type =
        reservation.type ??
        (methods.isNotEmpty
            ? methods.first.type
            : ReceivingMethodType.cardTransfer);
    final showsCards =
        type == ReceivingMethodType.cardTransfer ||
        type == ReceivingMethodType.paynetTerminal;
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
          if (showsCards) ...[
            Text(
              type == ReceivingMethodType.paynetTerminal
                  ? l10n.topupTerminalCardTitle
                  : l10n.topupReservedCardTitle,
              style: theme.textTheme.titleSmall,
            ),
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
                  type == ReceivingMethodType.paynetTerminal
                      ? l10n.topupTerminalCardNote
                      : l10n.topupNoCommissionNote,
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
            // The only type left once showsCards is false — QR_CODE is the
            // one option with genuinely distinct receiving-method data.
            Text(l10n.topupMethodQrCode, style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(
              l10n.topupQrInstructions,
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
                    data: _emvPayloadOf(methods.first.qrPayload!),
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
                  onPressed: () {
                    setState(() => _confirmedPaid = true);
                    // Fire-and-forget: pings the admin queue, but this
                    // button's whole job is switching to the waiting state
                    // regardless of whether the ping itself succeeds.
                    ref
                        .read(topupApiProvider)
                        .confirmPaid(widget.reservation.id)
                        .catchError((_) {});
                  },
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
