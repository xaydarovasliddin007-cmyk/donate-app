import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/selectable_chip.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/games_providers.dart';
import '../domain/game.dart';
import 'widgets/game_card.dart';

class AllGamesScreen extends ConsumerStatefulWidget {
  const AllGamesScreen({super.key, this.initialCategory});

  final String? initialCategory;

  @override
  ConsumerState<AllGamesScreen> createState() => _AllGamesScreenState();
}

class _AllGamesScreenState extends ConsumerState<AllGamesScreen> {
  final _searchController = TextEditingController();
  String _query = '';
  String? _selectedCategory;

  @override
  void initState() {
    super.initState();
    _selectedCategory = widget.initialCategory;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() => _query = '');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final gamesAsync = ref.watch(gamesListProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.allGamesTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(gamesListProvider),
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (value) =>
                    setState(() => _query = value.trim().toLowerCase()),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          tooltip: l10n.allGamesClearSearch,
                          icon: const Icon(Icons.close_rounded),
                          onPressed: _clearSearch,
                        ),
                  hintText: l10n.homeSearchHint,
                ),
              ),
            ),
            gamesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.only(top: AppSpacing.md),
                child: GameGridSkeleton(count: 9),
              ),
              error: (error, _) {
                final failure = Failure.from(error);
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: ErrorView(
                    title: failure.isNetworkError
                        ? l10n.errorNoConnectionTitle
                        : l10n.errorGenericTitle,
                    message: failure.isNetworkError
                        ? l10n.errorNoConnectionMessage
                        : l10n.errorGenericMessage,
                    retryLabel: l10n.commonRetry,
                    onRetry: () => ref.invalidate(gamesListProvider),
                  ),
                );
              },
              data: (games) {
                final categories = <String>{
                  for (final game in games)
                    if (game.category != null) game.category!,
                }.toList()..sort();

                final filtered = games.where((game) {
                  final matchesQuery =
                      _query.isEmpty || game.name.toLowerCase().contains(_query);
                  final matchesCategory =
                      _selectedCategory == null ||
                      game.category == _selectedCategory;
                  return matchesQuery && matchesCategory;
                }).toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (categories.isNotEmpty)
                      SizedBox(
                        height: 42,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(
                                right: AppSpacing.sm,
                              ),
                              child: SelectableChip(
                                label: l10n.allGamesAllCategories,
                                selected: _selectedCategory == null,
                                onTap: () =>
                                    setState(() => _selectedCategory = null),
                              ),
                            ),
                            for (final category in categories)
                              Padding(
                                padding: const EdgeInsets.only(
                                  right: AppSpacing.sm,
                                ),
                                child: SelectableChip(
                                  label: category,
                                  selected: _selectedCategory == category,
                                  onTap: () => setState(
                                    () => _selectedCategory =
                                        _selectedCategory == category
                                        ? null
                                        : category,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.sm,
                        AppSpacing.lg,
                        AppSpacing.sm,
                      ),
                      child: Text(
                        l10n.allGamesResultsCount(filtered.length),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (filtered.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        child: EmptyView(title: l10n.emptyGenericTitle),
                      )
                    else
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                        ),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              mainAxisSpacing: AppSpacing.sm,
                              crossAxisSpacing: AppSpacing.sm,
                              childAspectRatio: 0.64,
                            ),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final Game game = filtered[index];
                          return StaggeredEntrance(
                            index: index,
                            child: GameCard(
                              game: game,
                              onTap: () => context.push('/games/${game.id}'),
                            ),
                          );
                        },
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
