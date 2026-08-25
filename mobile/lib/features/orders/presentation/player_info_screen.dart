import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money_formatter.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';
import '../../saved_games/application/saved_games_providers.dart';
import '../../saved_games/domain/saved_game.dart';
import '../domain/player_id_field_spec.dart';

class PlayerInfoScreen extends ConsumerStatefulWidget {
  const PlayerInfoScreen({
    super.key,
    required this.game,
    required this.product,
    this.serverCode,
    this.serverName,
  });

  final Game game;
  final Product product;
  // Set only for games with a real server catalog (Mobile Legends, Genshin
  // Impact today) — the server was already chosen (and priced) on the
  // game's own screen, so this screen shows it read-only instead of asking
  // again. Null for every other game — which, correctly, asks for nothing
  // beyond the player identifier at all: most top-up providers (Codashop,
  // UniPin) only ask PUBG Mobile/Free Fire/Call of Duty Mobile/etc. for a
  // single ID, never a "server", so a generic free-text server field shown
  // for every game regardless was asking for information that game's real
  // top-up flow doesn't use.
  final String? serverCode;
  final String? serverName;

  @override
  ConsumerState<PlayerInfoScreen> createState() => _PlayerInfoScreenState();
}

class _PlayerInfoScreenState extends ConsumerState<PlayerInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _playerIdController = TextEditingController();

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
    }
  }

  @override
  void dispose() {
    _playerIdController.dispose();
    super.dispose();
  }

  void _continue() {
    if (!_formKey.currentState!.validate()) return;
    context.push(
      '/checkout/confirm',
      extra: {
        'game': widget.game,
        'product': widget.product,
        'playerId': _playerIdController.text.trim(),
        'serverId': _hasFixedServer ? widget.serverCode! : '',
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final localeName = Localizations.localeOf(context).toString();
    final (label, hint) = switch (_fieldSpec.type) {
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

    return Scaffold(
      appBar: AppBar(title: Text(l10n.playerInfoTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ProductSummaryCard(
                  game: widget.game,
                  product: widget.product,
                  localeName: localeName,
                ),
                const SizedBox(height: AppSpacing.xl),
                TextFormField(
                  controller: _playerIdController,
                  autofocus: true,
                  keyboardType: _fieldSpec.type == PlayerIdFieldType.numericId
                      ? TextInputType.number
                      : TextInputType.text,
                  textInputAction: _hasFixedServer
                      ? TextInputAction.done
                      : TextInputAction.next,
                  onFieldSubmitted: _hasFixedServer ? (_) => _continue() : null,
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
                      child: Icon(
                        _fieldSpec.icon,
                        size: 14,
                        color: Colors.white,
                      ),
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
                // Only shown for games with a real server catalog (their
                // server was already picked on the game's own page); every
                // other game needs nothing here — no fallback text field.
                if (_hasFixedServer) ...[
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.md,
                    ),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest
                          .withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(
                        color: theme.colorScheme.outlineVariant,
                      ),
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
                          l10n.playerInfoServerIdLabel,
                          style: theme.textTheme.bodyMedium,
                        ),
                        const Spacer(),
                        Text(
                          widget.serverName ?? widget.serverCode!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.xl),
                _GradientContinueButton(
                  onTap: _continue,
                  label: l10n.playerInfoContinueButton,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// What's being bought, up top — a game icon + product name + price, so the
/// player-ID form below always has visible context for what it's for
/// (easy to lose track of once you're staring at a bare text field).
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
              width: 52,
              height: 52,
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
                          style: const TextStyle(fontSize: 24),
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

class _GradientContinueButton extends StatelessWidget {
  const _GradientContinueButton({required this.onTap, required this.label});

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
