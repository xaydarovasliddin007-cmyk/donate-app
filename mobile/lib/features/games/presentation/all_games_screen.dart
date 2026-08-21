import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/errors/failure.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/empty_view.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/skeletons.dart';
import '../../../core/widgets/staggered_entrance.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/games_providers.dart';
import '../domain/game.dart';
import 'widgets/game_card.dart';

/// The full catalog — reached from the bottom nav's dedicated "Games" tab
/// (denser 3-column grid than the home screen's curated preview) and from
/// the home screen's "See all" link. Same search/category-filter logic as
/// the home screen preview, just not sharing a widget: the home preview is
/// tied to a `ListView` alongside unrelated sections, this is a standalone
/// scrollable screen — forcing them into one shared widget would mean
/// threading scroll-ownership through both call sites for no real reuse win.
class AllGamesScreen extends ConsumerStatefulWidget {
  const AllGamesScreen({super.key, this.initialCategory});

  /// Set when arriving from a home-screen category shortcut, so the tap
  /// actually lands pre-filtered instead of just parking on the unfiltered
  /// catalog with the same category the user already tapped.
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
                  for (final g in games)
                    if (g.category != null) g.category!,
                }.toList()..sort();

                final filtered = games.where((g) {
                  final matchesQuery =
                      _query.isEmpty || g.name.toLowerCase().contains(_query);
                  final matchesCategory =
                      _selectedCategory == null ||
                      g.category == _selectedCategory;
                  return matchesQuery && matchesCategory;
                }).toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (categories.isNotEmpty)
                      SizedBox(
                        height: 40,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                          children: [
                            for (final category in categories)
                              Padding(
                                padding: const EdgeInsets.only(
                                  right: AppSpacing.sm,
                                ),
                                child: ChoiceChip(
                                  label: Text(category),
                                  selected: _selectedCategory == category,
                                  onSelected: (selected) {
                                    setState(
                                      () => _selectedCategory = selected
                                          ? category
                                          : null,
                                    );
                                  },
                                ),
                              ),
                          ],
                        ),
                      ),
                    const SizedBox(height: AppSpacing.sm),
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
                              childAspectRatio: 0.58,
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
