import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../l10n/generated/app_localizations.dart';

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = ref.watch(localeControllerProvider);
    final themeMode = ref.watch(themeModeControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Text(
                l10n.onboardingWelcomeTitle,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.onboardingWelcomeSubtitle,
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(l10n.onboardingChooseLanguage, style: Theme.of(context).textTheme.labelLarge),
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
              const SizedBox(height: AppSpacing.lg),
              Text(l10n.onboardingChooseTheme, style: Theme.of(context).textTheme.labelLarge),
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
              const Spacer(flex: 2),
              FilledButton(
                onPressed: () async {
                  await ref.read(preferencesServiceProvider).setOnboardingComplete();
                  if (context.mounted) context.go('/home');
                },
                child: Text(l10n.onboardingGetStarted),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ),
        ),
      ),
    );
  }
}
