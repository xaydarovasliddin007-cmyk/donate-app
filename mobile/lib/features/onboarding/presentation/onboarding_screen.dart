import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_colors.dart';
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
    final isDark = theme.brightness == Brightness.dark;
    final gradient = isDark
        ? AppColors.heroGradientDark
        : AppColors.heroGradientLight;

    final features = [
      (Icons.bolt_rounded, l10n.onboardingFeatureInstant),
      (Icons.shield_rounded, l10n.onboardingFeatureSecure),
      (Icons.sports_esports_rounded, l10n.onboardingFeatureCatalog),
    ];

    return Scaffold(
      body: Stack(
        children: [
          // Soft brand-colored glow anchored behind the mark — the single
          // cheapest way to make a plain icon+text screen read as designed
          // rather than a placeholder, without touching layout/behavior.
          Positioned(
            top: -120,
            left: -80,
            child: _Glow(color: gradient.first, size: 320),
          ),
          Positioned(
            top: 40,
            right: -100,
            child: _Glow(color: gradient.last, size: 260),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              // A fixed-height Column with two Spacers reads great on a
              // normal phone but hard-overflows on a short viewport (a
              // small/older device, split-screen, or a landscape phone) —
              // LayoutBuilder + minHeight lets the Spacers still center
              // everything when it fits, and lets the content scroll
              // instead of clipping when it doesn't.
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
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
                          const SizedBox(height: AppSpacing.xl),
                          ...features.map(
                            (f) => Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.xs,
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: gradient.first.withValues(
                                        alpha: 0.14,
                                      ),
                                      borderRadius: BorderRadius.circular(
                                        AppRadius.sm,
                                      ),
                                    ),
                                    child: Icon(
                                      f.$1,
                                      size: 16,
                                      color: gradient.first,
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Text(
                                    f.$2,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const Spacer(flex: 4),
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              boxShadow: [
                                BoxShadow(
                                  color: gradient.first.withValues(alpha: 0.35),
                                  blurRadius: 24,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: gradient.first,
                                padding: const EdgeInsets.symmetric(
                                  vertical: AppSpacing.md,
                                ),
                              ),
                              onPressed: () async {
                                await ref
                                    .read(preferencesServiceProvider)
                                    .setOnboardingComplete();
                                if (context.mounted) context.go('/home');
                              },
                              child: Text(l10n.onboardingGetStarted),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A large, heavily-blurred, low-opacity circle — decorative brand-color
/// ambience behind the fold, never interactive (IgnorePointer) so it can
/// never steal a tap from the content stacked on top of it.
class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}
