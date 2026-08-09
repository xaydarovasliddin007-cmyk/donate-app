import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/storage/preferences_provider.dart';
import '../../../core/theme/app_colors.dart';
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
    return const Scaffold(
      body: Center(
        child: Text(
          'Donate App',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.brandPrimary),
        ),
      ),
    );
  }
}
