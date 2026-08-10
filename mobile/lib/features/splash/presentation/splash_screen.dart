import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/app_branding.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../auth/application/auth_controller.dart';

/// Bridges the gap between the native splash (gone after Flutter's first
/// frame) and the app being ready to route: waits for auth hydration to
/// settle, then sends the user to onboarding (first launch) or straight to
/// home — guests included, browsing is never gated behind login.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _proceed();
  }

  Future<void> _proceed() async {
    await Future.wait([
      ref.read(authControllerProvider.future).catchError((_) => AuthState.guest),
      Future.delayed(const Duration(milliseconds: 450)),
    ]);
    if (!mounted) return;

    final hasCompletedOnboarding = ref.read(preferencesServiceProvider).hasCompletedOnboarding;
    context.go(hasCompletedOnboarding ? '/home' : '/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 900),
          curve: Curves.easeOutCubic,
          builder: (context, t, child) {
            return Opacity(
              opacity: t,
              child: Transform.scale(scale: 0.9 + (0.1 * t), child: child),
            );
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandMark(size: 88),
              const SizedBox(height: 16),
              Text(
                AppBranding.appName,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 1.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
