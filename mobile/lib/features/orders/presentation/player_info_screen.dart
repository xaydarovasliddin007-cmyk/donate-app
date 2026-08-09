import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../games/domain/game.dart';
import '../../games/domain/product.dart';

class PlayerInfoScreen extends StatefulWidget {
  const PlayerInfoScreen({super.key, required this.game, required this.product});

  final Game game;
  final Product product;

  @override
  State<PlayerInfoScreen> createState() => _PlayerInfoScreenState();
}

class _PlayerInfoScreenState extends State<PlayerInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _playerIdController = TextEditingController();
  final _serverIdController = TextEditingController();

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
        'serverId': _serverIdController.text.trim(),
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
