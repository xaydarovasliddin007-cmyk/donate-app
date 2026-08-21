import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/generated/app_localizations.dart';

/// A single welcome screen, not a language/theme wizard — the app already
/// follows the device's language and theme automatically (see
/// LocaleController/ThemeModeController), so onboarding never has to ask.
/// Both remain adjustable later from Profile > Settings.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 3),
              Center(
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: AppMotion.entrance,
                  curve: AppMotion.standard,
                  builder: (context, t, child) => Opacity(
                    opacity: t,
                    child: Transform.scale(
                      scale: 0.92 + (0.08 * t),
                      child: child,
                    ),
                  ),
                  child: const BrandMark(size: 96),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                l10n.onboardingWelcomeTitle,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.onboardingWelcomeSubtitle,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(flex: 4),
              FilledButton(
                onPressed: () async {
                  await ref
                      .read(preferencesServiceProvider)
                      .setOnboardingComplete();
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
