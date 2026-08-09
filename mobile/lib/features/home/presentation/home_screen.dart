import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../l10n/generated/app_localizations.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final themeMode = ref.watch(themeModeControllerProvider);
    final locale = ref.watch(localeControllerProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.homeTitle)),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.homeWelcomeMessage, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xl),
            Text(l10n.settingsLanguage, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            SegmentedButton<Locale>(
              segments: [
                ButtonSegment(value: const Locale('uz'), label: Text(l10n.languageUzbek)),
                ButtonSegment(value: const Locale('ru'), label: Text(l10n.languageRussian)),
              ],
              selected: {locale},
              onSelectionChanged: (selection) {
                ref.read(localeControllerProvider.notifier).setLocale(selection.first);
              },
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(l10n.settingsTheme, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: AppSpacing.sm),
            SegmentedButton<ThemeMode>(
              segments: [
                ButtonSegment(value: ThemeMode.light, label: Text(l10n.settingsThemeLight)),
                ButtonSegment(value: ThemeMode.dark, label: Text(l10n.settingsThemeDark)),
                ButtonSegment(value: ThemeMode.system, label: Text(l10n.settingsThemeSystem)),
              ],
              selected: {themeMode},
              onSelectionChanged: (selection) {
                ref.read(themeModeControllerProvider.notifier).setThemeMode(selection.first);
              },
            ),
          ],
        ),
      ),
    );
  }
}
