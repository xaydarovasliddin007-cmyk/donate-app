import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/branding/app_branding.dart';
import '../../../core/branding/brand_mark.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../auth/application/auth_controller.dart';

/// Bridges the gap between the native splash (gone after Flutter's first
/// frame) and the app being ready to route.
///
/// IMPORTANT: navigation here must never depend on network I/O. It used to
/// `await authControllerProvider.future` — which reads the Keystore and, if
/// a token exists, makes a live `/auth/me` call with a 10-15s Dio timeout —
/// so on a slow/unreachable backend the app would appear frozen on this
/// screen for seconds. Auth hydration is now only *kicked off* here (fire
/// and forget) and resolves in the background; every screen that cares
/// (Home, Profile, checkout) already watches `authControllerProvider`
/// reactively, so the UI upgrades from guest to authenticated the moment it
/// settles instead of gating the first frame on it.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Start auth hydration in the background — do NOT await it.
    ref.read(authControllerProvider);
    _proceed();
  }

  Future<void> _proceed() async {
    // Purely cosmetic — just long enough for the logo entrance to read.
    // Reading the onboarding flag is synchronous (SharedPreferences is
    // already loaded before runApp), so nothing else gates this.
    await Future.delayed(const Duration(milliseconds: 480));
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
          duration: const Duration(milliseconds: 420),
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
