import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/reduce_motion_controller.dart';
import '../../../core/utils/idempotency_key.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';
import '../../payments/application/payments_providers.dart';
import '../../saved_games/application/saved_games_providers.dart';
import '../../saved_games/domain/saved_game.dart';
import '../../topup/presentation/widgets/topup_bottom_sheet.dart';
import '../../wallet/application/wallet_providers.dart';
import '../application/orders_providers.dart';
import '../domain/player_id_field_spec.dart';
import '../domain/player_validation.dart';

enum _Step { data, payment, confirmation }

enum _PaymentMethod { wallet, payme, click, mock }

/// A single "Купить"-style screen (matching the reference three-tab flow:
/// Data → Payment → Confirmation) replacing what used to be two separate
/// pushed routes (PlayerInfoScreen, CheckoutScreen). Keeping it one screen
/// with internal step state — rather than three routes — is what lets the
/// product summary and step indicator stay pinned at the top exactly like
/// the reference while the body underneath swaps.
class PurchaseFlowScreen extends ConsumerStatefulWidget {
  const PurchaseFlowScreen({
    super.key,
    required this.game,
    required this.product,
    this.serverCode,
    this.serverName,
  });

  final Game game;
  final Product product;
  final String? serverCode;
  final String? serverName;

  @override
  ConsumerState<PurchaseFlowScreen> createState() => _PurchaseFlowScreenState();
}

class _PurchaseFlowScreenState extends ConsumerState<PurchaseFlowScreen> {
  final _formKey = GlobalKey<FormState>();
  final _playerIdController = TextEditingController();
  final _zoneIdController = TextEditingController();
  Timer? _debounce;

  _Step _step = _Step.data;
  bool _validating = false;
  PlayerValidation? _validation;
  final List<String> _dismissedRecentIds = [];

  _PaymentMethod _method = _PaymentMethod.wallet;
  bool _submitting = false;
  String? _errorMessage;
  bool _insufficientBalance = false;
  late final String _idempotencyKey = generateIdempotencyKey();

  bool get _hasFixedServer => widget.serverCode != null;
  late final _fieldSpec = PlayerIdFieldSpec.forGameSlug(widget.game.slug);

  @override
  void initState() {
    super.initState();
    // Best-effort convenience: if this user already has a saved profile for
    // this game (from a prior order, or set via My Games), don't make them
    // retype it. Silently skipped if not loaded yet — never blocks the form.
    final savedGames = ref.read(savedGamesListProvider).value;
    SavedGame? match;
    for (final saved in savedGames ?? const <SavedGame>[]) {
      if (saved.game.id == widget.game.id) {
        match = saved;
        break;
      }
    }
    if (match != null) {
      _playerIdController.text = match.playerId;
      _scheduleValidate();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _playerIdController.dispose();
    _zoneIdController.dispose();
    super.dispose();
  }

  void _onIdentityChanged(String _) {
    setState(() => _validation = null);
    _debounce?.cancel();
    final playerId = _playerIdController.text.trim();
    if (playerId.isEmpty) return;
    if (_fieldSpec.requiresZoneId && _zoneIdController.text.trim().isEmpty) {
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 600), _scheduleValidate);
  }

  Future<void> _scheduleValidate() async {
    final playerId = _playerIdController.text.trim();
    final zoneId = _zoneIdController.text.trim();
    setState(() => _validating = true);
    try {
      final result = await ref
          .read(ordersApiProvider)
          .validatePlayer(
            gameId: widget.game.id,
            productId: widget.product.id,
            playerId: playerId,
            serverId: widget.serverCode,
            zoneId: zoneId.isEmpty ? null : zoneId,
          );
      if (!mounted) return;
      setState(() => _validation = result);
    } catch (_) {
      // Advisory only — a network hiccup or a not-yet-configured provider
      // never blocks the flow. The real check runs again when the order is
      // actually created.
      if (!mounted) return;
      setState(() => _validation = null);
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  void _selectRecent(String playerId) {
    _playerIdController.text = playerId;
    _onIdentityChanged(playerId);
  }

  void _continueFromData() {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _step = _Step.payment);
  }

  Future<void> _pay() async {
    HapticFeedback.mediumImpact();
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
      _insufficientBalance = false;
    });

    try {
      final order = await ref
          .read(ordersApiProvider)
          .createOrder(
            gameId: widget.game.id,
            productId: widget.product.id,
            playerId: _playerIdController.text.trim(),
            serverId: widget.serverCode,
            zoneId: _zoneIdController.text.trim().isEmpty
                ? null
                : _zoneIdController.text.trim(),
            idempotencyKey: _idempotencyKey,
          );

      if (_method == _PaymentMethod.wallet) {
        await ref
            .read(paymentsApiProvider)
            .payWithWallet(
              orderId: order.id,
              idempotencyKey: '$_idempotencyKey-pay',
            );
      } else {
        await ref
            .read(paymentsApiProvider)
            .createPayment(
              orderId: order.id,
              idempotencyKey: '$_idempotencyKey-pay',
              providerCode: switch (_method) {
                _PaymentMethod.payme => 'PAYME',
                _PaymentMethod.click => 'CLICK',
                _PaymentMethod.mock => 'DEV_MOCK_PAYMENT',
                _PaymentMethod.wallet => throw StateError('handled above'),
              },
            );
      }

      if (mounted) context.go('/orders/${order.id}');
    } catch (error) {
      final failure = Failure.from(error);
      setState(() {
        _insufficientBalance = failure.code == 'INSUFFICIENT_BALANCE';
        _errorMessage = failure.isNetworkError
            ? l10n.errorNoConnectionMessage
            : (_insufficientBalance
                  ? l10n.checkoutInsufficientBalanceMessage
                  : failure.message);
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Tops up without leaving the purchase flow — a modal sheet over this
  /// same screen, not a route push, so the step/player-ID/method state here
  /// is never at risk of unmounting. Retries the purchase automatically on
  /// success so a shortfall never means starting the 3-step flow over.
  Future<void> _topUpThenRetry() async {
    final wallet = ref.read(walletProvider).value;
    final shortfall = widget.product.amountMinor - (wallet?.balanceMinor ?? 0);
    if (shortfall <= 0) {
      setState(() => _insufficientBalance = false);
      return;
    }
    final toppedUp = await showTopUpBottomSheet(
      context,
      shortfallMinor: shortfall,
    );
    if (toppedUp == true && mounted) {
      setState(() => _insufficientBalance = false);
      await _pay();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final reduceMotion = ref.watch(reduceMotionProvider);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n.purchaseScreenTitle),
            Text(
              widget.game.name,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                0,
              ),
              child: _ProductSummaryCard(
                game: widget.game,
                product: widget.product,
                localeName: localeName,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _StepTabs(
              current: _step,
              onTap: (step) {
                // Only ever lets you jump *back* to an already-completed
                // step — never forward, since payment/confirmation depend
                // on data collected in the earlier ones.
                if (step.index < _step.index) setState(() => _step = step);
              },
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: AnimatedSwitcher(
                duration: reduceMotion ? Duration.zero : AppMotion.fast,
                child: KeyedSubtree(
                  key: ValueKey(_step),
                  child: switch (_step) {
                    _Step.data => _DataStep(
                      formKey: _formKey,
                      controller: _playerIdController,
                      zoneIdController: _zoneIdController,
                      fieldSpec: _fieldSpec,
                      hasFixedServer: _hasFixedServer,
                      serverLabel: widget.serverName ?? widget.serverCode,
                      recentIds: _recentIds(),
                      onRecentTap: _selectRecent,
                      onRecentDismiss: (id) =>
                          setState(() => _dismissedRecentIds.add(id)),
                      onChanged: _onIdentityChanged,
                      validating: _validating,
                      validation: _validation,
                      onContinue: _continueFromData,
                    ),
                    _Step.payment => _PaymentStep(
                      method: _method,
                      onSelect: (m) => setState(() => _method = m),
                      onContinue: () =>
                          setState(() => _step = _Step.confirmation),
                    ),
                    _Step.confirmation => _ConfirmationStep(
                      game: widget.game,
                      product: widget.product,
                      playerLabel:
                          _validation?.playerName ??
                          _playerIdController.text.trim(),
                      method: _method,
                      localeName: localeName,
                      submitting: _submitting,
                      errorMessage: _errorMessage,
                      insufficientBalance: _insufficientBalance,
                      onPay: _pay,
                      onTopUp: _topUpThenRetry,
                    ),
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Up to 3 distinct Player IDs this user has actually used for this game
  /// before, newest first — derived from their own order history (not
  /// invented data), so tapping one is a real shortcut to an account they
  /// really used, not a guess.
  List<String> _recentIds() {
    final orders = ref.watch(myOrdersProvider).value ?? const [];
    final seen = <String>{};
    final result = <String>[];
    for (final order in orders) {
      if (order.game.id != widget.game.id) continue;
      if (!seen.add(order.playerId)) continue;
      if (_dismissedRecentIds.contains(order.playerId)) continue;
      result.add(order.playerId);
      if (result.length == 3) break;
    }
    return result;
  }
}

class _StepTabs extends StatelessWidget {
  const _StepTabs({required this.current, required this.onTap});

  final _Step current;
  final ValueChanged<_Step> onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final labels = [
      l10n.purchaseStepData,
      l10n.purchaseStepPayment,
      l10n.purchaseStepConfirmation,
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Row(
        children: [
          for (final step in _Step.values)
            Expanded(
              child: GestureDetector(
                onTap: () => onTap(step),
                behavior: HitTestBehavior.opaque,
                child: _StepTab(
                  label: labels[step.index],
                  state: step.index < current.index
                      ? _TabState.done
                      : step == current
                      ? _TabState.active
                      : _TabState.upcoming,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

enum _TabState { done, active, upcoming }

class _StepTab extends StatelessWidget {
  const _StepTab({required this.label, required this.state});

  final String label;
  final _TabState state;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;
    final active = state != _TabState.upcoming;

    return Column(
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelLarge?.copyWith(
            color: active
                ? theme.colorScheme.onSurface
                : theme.colorScheme.onSurfaceVariant,
            fontWeight: state == _TabState.active
                ? FontWeight.w800
                : FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        AnimatedContainer(
          duration: AppMotion.fast,
          height: 3,
          decoration: BoxDecoration(
            gradient: active ? LinearGradient(colors: gradient) : null,
            color: active
                ? null
                : theme.colorScheme.outlineVariant.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
        ),
      ],
    );
  }
}

/// Step 1: Player ID (+ read-only region, when the game has one), recent-ID
/// quick-select chips, and a live "does this account exist" check.
class _DataStep extends StatelessWidget {
  const _DataStep({
    required this.formKey,
    required this.controller,
    required this.zoneIdController,
    required this.fieldSpec,
    required this.hasFixedServer,
    required this.serverLabel,
    required this.recentIds,
    required this.onRecentTap,
    required this.onRecentDismiss,
    required this.onChanged,
    required this.validating,
    required this.validation,
    required this.onContinue,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController controller;
  final TextEditingController zoneIdController;
  final PlayerIdFieldSpec fieldSpec;
  final bool hasFixedServer;
  final String? serverLabel;
  final List<String> recentIds;
  final ValueChanged<String> onRecentTap;
  final ValueChanged<String> onRecentDismiss;
  final ValueChanged<String> onChanged;
  final bool validating;
  final PlayerValidation? validation;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final (label, hint) = switch (fieldSpec.type) {
      PlayerIdFieldType.numericId => (
        l10n.playerInfoPlayerIdLabel,
        l10n.playerInfoPlayerIdHint,
      ),
      PlayerIdFieldType.tag => (
        l10n.playerInfoPlayerTagLabel,
        l10n.playerInfoPlayerTagHint,
      ),
      PlayerIdFieldType.username => (
        l10n.playerInfoUsernameLabel,
        l10n.playerInfoUsernameHint,
      ),
    };

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (recentIds.isNotEmpty) ...[
              SizedBox(
                height: 40,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: recentIds.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: AppSpacing.sm),
                  itemBuilder: (context, i) => _RecentIdChip(
                    playerId: recentIds[i],
                    onTap: () => onRecentTap(recentIds[i]),
                    onDismiss: () => onRecentDismiss(recentIds[i]),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            TextFormField(
              controller: controller,
              autofocus: true,
              onChanged: onChanged,
              keyboardType: fieldSpec.type == PlayerIdFieldType.numericId
                  ? TextInputType.number
                  : TextInputType.text,
              decoration: InputDecoration(
                labelText: label,
                hintText: hint,
                prefixIcon: Container(
                  margin: const EdgeInsets.all(10),
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isDark
                          ? AppColors.heroGradientDark
                          : AppColors.heroGradientLight,
                    ),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Icon(fieldSpec.icon, size: 14, color: Colors.white),
                ),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.help_outline_rounded),
                  tooltip: l10n.playerInfoExampleLabel,
                  onPressed: () {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(hint)));
                  },
                ),
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? l10n.playerInfoValidationError
                  : null,
            ),
            if (fieldSpec.requiresZoneId) ...[
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: zoneIdController,
                onChanged: onChanged,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: l10n.playerInfoServerIdLabel,
                  hintText: l10n.playerInfoServerIdHint,
                  prefixIcon: Container(
                    margin: const EdgeInsets.all(10),
                    width: 24,
                    height: 24,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? AppColors.heroGradientDark
                            : AppColors.heroGradientLight,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: const Icon(
                      Icons.dns_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.playerInfoServerIdValidationError
                    : null,
              ),
            ],
            if (hasFixedServer) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.md,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest.withValues(
                    alpha: 0.6,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isDark
                              ? AppColors.heroGradientDark
                              : AppColors.heroGradientLight,
                        ),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: const Icon(
                        Icons.dns_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      l10n.purchaseRegionLabel,
                      style: theme.textTheme.bodyMedium,
                    ),
                    const Spacer(),
                    Text(
                      serverLabel ?? '',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            AnimatedSwitcher(
              duration: AppMotion.fast,
              switchInCurve: AppMotion.emphasized,
              switchOutCurve: Curves.easeIn,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SizeTransition(
                  sizeFactor: animation,
                  alignment: Alignment.topCenter,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0, -0.12),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
              ),
              child: validating
                  ? Row(
                      key: const ValueKey('validating'),
                      children: [
                        const SizedBox(
                          height: 14,
                          width: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          l10n.purchaseValidatingMessage,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    )
                  : validation != null
                  ? _ValidationBanner(
                      key: const ValueKey('result'),
                      validation: validation!,
                    )
                  : const SizedBox.shrink(key: ValueKey('empty')),
            ),
            const SizedBox(height: AppSpacing.xl),
            _GradientButton(onTap: onContinue, label: l10n.commonContinue),
          ],
        ),
      ),
    );
  }
}

class _RecentIdChip extends StatelessWidget {
  const _RecentIdChip({
    required this.playerId,
    required this.onTap,
    required this.onDismiss,
  });

  final String playerId;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(
            alpha: 0.6,
          ),
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.history_rounded,
              size: 14,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 6),
            Text(playerId, style: theme.textTheme.labelLarge),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onDismiss,
              child: Icon(
                Icons.close_rounded,
                size: 14,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ValidationBanner extends StatelessWidget {
  const _ValidationBanner({super.key, required this.validation});

  final PlayerValidation validation;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final color = validation.valid
        ? AppColors.success
        : theme.colorScheme.error;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: AppMotion.medium,
            curve: Curves.elasticOut,
            builder: (context, t, child) =>
                Transform.scale(scale: t.clamp(0.0, 1.15), child: child),
            child: Icon(
              validation.valid
                  ? Icons.check_circle_rounded
                  : Icons.error_rounded,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              validation.valid
                  ? l10n.purchaseFoundMessage(validation.playerName ?? '')
                  : (validation.reason ?? l10n.errorGenericMessage),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Step 2: payment method — a plain radio row per method, matching the
/// reference's minimal style rather than the heavier icon-badge tile used
/// elsewhere, since a payment-method *list* reads better dense.
class _PaymentStep extends ConsumerWidget {
  const _PaymentStep({
    required this.method,
    required this.onSelect,
    required this.onContinue,
  });

  final _PaymentMethod method;
  final ValueChanged<_PaymentMethod> onSelect;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final localeName = Localizations.localeOf(context).toString();
    final walletAsync = ref.watch(walletProvider);

    final options = <(_PaymentMethod, IconData, String, String?)>[
      (
        _PaymentMethod.wallet,
        Icons.account_balance_wallet_outlined,
        l10n.checkoutPayWithWalletLabel,
        walletAsync.when(
          loading: () => null,
          error: (_, _) => null,
          data: (wallet) => l10n.checkoutPayWithWalletBalance(
            formatMoney(wallet.balanceMinor, wallet.currency, localeName),
          ),
        ),
      ),
      (
        _PaymentMethod.payme,
        Icons.qr_code_rounded,
        l10n.checkoutPayWithPaymeLabel,
        l10n.checkoutPayWithPaymeSubtitle,
      ),
      (
        _PaymentMethod.click,
        Icons.touch_app_rounded,
        l10n.checkoutPayWithClickLabel,
        l10n.checkoutPayWithClickSubtitle,
      ),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.checkoutPaymentMethodLabel,
            style: theme.textTheme.titleSmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final option in options)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _PaymentRadioTile(
                icon: option.$2,
                title: option.$3,
                subtitle: option.$4,
                selected: method == option.$1,
                onTap: () => onSelect(option.$1),
              ),
            ),
          if (kDebugMode)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: TextButton.icon(
                onPressed: () => onSelect(_PaymentMethod.mock),
                icon: Icon(
                  method == _PaymentMethod.mock
                      ? Icons.check_circle_rounded
                      : Icons.bug_report_outlined,
                  size: 16,
                ),
                label: Text(l10n.checkoutMockPaymentLabel),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          _GradientButton(onTap: onContinue, label: l10n.commonContinue),
        ],
      ),
    );
  }
}

class _PaymentRadioTile extends StatelessWidget {
  const _PaymentRadioTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppMotion.fast,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected
              ? theme.colorScheme.primary.withValues(alpha: 0.08)
              : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.outlineVariant,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            AnimatedSwitcher(
              duration: AppMotion.fast,
              child: Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                key: ValueKey(selected),
                color: selected
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outlineVariant,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: theme.textTheme.titleSmall),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step 3: final summary — the resolved player *name* is shown when a
/// validation succeeded (matching the reference), falling back to the raw
/// ID typed in otherwise.
class _ConfirmationStep extends StatelessWidget {
  const _ConfirmationStep({
    required this.game,
    required this.product,
    required this.playerLabel,
    required this.method,
    required this.localeName,
    required this.submitting,
    required this.errorMessage,
    required this.insufficientBalance,
    required this.onPay,
    required this.onTopUp,
  });

  final Game game;
  final Product product;
  final String playerLabel;
  final _PaymentMethod method;
  final String localeName;
  final bool submitting;
  final String? errorMessage;
  final bool insufficientBalance;
  final VoidCallback onPay;
  final VoidCallback onTopUp;

  String _methodLabel(AppLocalizations l10n) => switch (method) {
    _PaymentMethod.wallet => l10n.checkoutPayWithWalletLabel,
    _PaymentMethod.payme => l10n.checkoutPayWithPaymeLabel,
    _PaymentMethod.click => l10n.checkoutPayWithClickLabel,
    _PaymentMethod.mock => l10n.checkoutMockPaymentLabel,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Column(
              children: [
                _SummaryRow(
                  label: l10n.checkoutPlayerIdLabel,
                  value: playerLabel,
                ),
                _SummaryRow(
                  label: l10n.checkoutPaymentMethodLabel,
                  value: _methodLabel(l10n),
                ),
                const Divider(height: AppSpacing.lg),
                _SummaryRow(
                  label: l10n.purchaseAmountToPayLabel,
                  value: formatMoney(
                    product.amountMinor,
                    product.currency,
                    localeName,
                  ),
                  emphasize: true,
                ),
              ],
            ),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              errorMessage!,
              style: TextStyle(color: theme.colorScheme.error),
            ),
            if (insufficientBalance) ...[
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton(
                onPressed: onTopUp,
                child: Text(l10n.checkoutTopUpNowButton),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.xl),
          FilledButton(
            onPressed: submitting ? null : onPay,
            child: submitting
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(l10n.checkoutCreatingOrder),
                    ],
                  )
                : Text(l10n.purchasePayButton),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: emphasize
                  ? theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    )
                  : theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductSummaryCard extends StatelessWidget {
  const _ProductSummaryCard({
    required this.game,
    required this.product,
    required this.localeName,
  });

  final Game game;
  final Product product;
  final String localeName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient =
        AppColors.tileGradients[game.name.hashCode.abs() %
            AppColors.tileGradients.length];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(
            alpha: isDark ? 0.4 : 0.7,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: SizedBox(
              width: 44,
              height: 44,
              child: game.logoUrl != null
                  ? CachedNetworkImage(
                      imageUrl: game.logoUrl!,
                      fit: BoxFit.cover,
                    )
                  : DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: gradient,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          game.logoEmoji ?? '🎮',
                          style: const TextStyle(fontSize: 20),
                        ),
                      ),
                    ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  product.name,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  game.name,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            formatMoney(product.amountMinor, product.currency, localeName),
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  const _GradientButton({required this.onTap, required this.label});

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    return PressableScale(
      onTap: onTap,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(AppRadius.md),
          boxShadow: [
            BoxShadow(
              color: gradient.first.withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
