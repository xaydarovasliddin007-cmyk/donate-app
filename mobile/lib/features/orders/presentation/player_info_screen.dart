import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';
import '../../saved_games/application/saved_games_providers.dart';
import '../../saved_games/domain/saved_game.dart';

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
  // Set only for games with a server catalog — the server was already
  // chosen (and priced) on the game's own screen, so this screen shows it
  // read-only instead of asking again. Null for every other game, which
  // keeps the free-text field below exactly as it always was.
  final String? serverCode;
  final String? serverName;

  @override
  ConsumerState<PlayerInfoScreen> createState() => _PlayerInfoScreenState();
}

class _PlayerInfoScreenState extends ConsumerState<PlayerInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _playerIdController = TextEditingController();
  final _serverIdController = TextEditingController();

  bool get _hasFixedServer => widget.serverCode != null;

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
      if (!_hasFixedServer) _serverIdController.text = match.serverId ?? '';
    }
  }

  @override
  void dispose() {
    _playerIdController.dispose();
    _serverIdController.dispose();
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
        'serverId': _hasFixedServer ? widget.serverCode! : _serverIdController.text.trim(),
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

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
                Text(widget.product.name, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _playerIdController,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: l10n.playerInfoPlayerIdLabel,
                    hintText: l10n.playerInfoPlayerIdHint,
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.help_outline_rounded),
                      tooltip: l10n.playerInfoExampleLabel,
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(l10n.playerInfoPlayerIdHint)),
                        );
                      },
                    ),
                  ),
                  validator: (value) =>
                      (value == null || value.trim().isEmpty) ? l10n.playerInfoValidationError : null,
                ),
                const SizedBox(height: AppSpacing.md),
                if (_hasFixedServer)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.dns_rounded, size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
                        const SizedBox(width: AppSpacing.sm),
                        Text(l10n.playerInfoServerIdLabel, style: Theme.of(context).textTheme.bodyMedium),
                        const Spacer(),
                        Text(
                          widget.serverName ?? widget.serverCode!,
                          style: Theme.of(
                            context,
                          ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  )
                else
                  TextFormField(
                    controller: _serverIdController,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _continue(),
                    decoration: InputDecoration(
                      labelText: l10n.playerInfoServerIdLabel,
                      hintText: l10n.playerInfoServerIdHint,
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty) ? l10n.playerInfoValidationError : null,
                  ),
                const SizedBox(height: AppSpacing.lg),
                FilledButton(onPressed: _continue, child: Text(l10n.playerInfoContinueButton)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
