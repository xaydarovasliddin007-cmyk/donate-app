import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/complete_registration_screen.dart';
import '../../features/games/domain/game.dart';
import '../../features/games/domain/product.dart';
import '../../features/games/presentation/all_games_screen.dart';
import '../../features/games/presentation/game_details_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/orders/presentation/checkout_screen.dart';
import '../../features/orders/presentation/order_history_screen.dart';
import '../../features/orders/presentation/order_status_screen.dart';
import '../../features/orders/presentation/player_info_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/profile/presentation/security_center_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/topup/presentation/topup_screen.dart';
import '../../features/wallet/presentation/wallet_history_screen.dart';
import '../theme/app_motion.dart';
import 'app_shell.dart';

abstract final class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const registerComplete = '/register/complete';
  static const home = '/home';
  static const games = '/catalog';
  static const orders = '/orders';
  static const profile = '/profile';
}

/// A subtle fade + upward-slide push transition, used for every route pushed
/// on top of the bottom-nav shell — the shell's own tab switches stay
/// instant (no transition), only "going somewhere new" animates.
CustomTransitionPage<void> _fadeSlidePage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: AppMotion.medium,
    reverseTransitionDuration: AppMotion.medium,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: AppMotion.standard,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.04),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: AppRoutes.splash,
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const LoginScreen()),
      ),
      GoRoute(
        path: AppRoutes.register,
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const RegisterScreen()),
      ),
      GoRoute(
        path: AppRoutes.registerComplete,
        pageBuilder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return _fadeSlidePage(
            state,
            CompleteRegistrationScreen(
              email: extra['email']! as String,
              displayName: extra['displayName'] as String?,
            ),
          );
        },
      ),

      GoRoute(
        path: '/games/:gameId',
        pageBuilder: (context, state) => _fadeSlidePage(
          state,
          GameDetailsScreen(gameId: state.pathParameters['gameId']!),
        ),
      ),
      GoRoute(
        path: '/checkout/player-info',
        pageBuilder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return _fadeSlidePage(
            state,
            PlayerInfoScreen(
              game: extra['game']! as Game,
              product: extra['product']! as Product,
              serverCode: extra['serverCode'] as String?,
              serverName: extra['serverName'] as String?,
            ),
          );
        },
      ),
      GoRoute(
        path: '/checkout/confirm',
        pageBuilder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return _fadeSlidePage(
            state,
            CheckoutScreen(
              game: extra['game']! as Game,
              product: extra['product']! as Product,
              playerId: extra['playerId']! as String,
              serverId: extra['serverId']! as String,
            ),
          );
        },
      ),
      GoRoute(
        path: '/orders/:orderId',
        pageBuilder: (context, state) => _fadeSlidePage(
          state,
          OrderStatusScreen(orderId: state.pathParameters['orderId']!),
        ),
      ),
      GoRoute(
        path: '/wallet/topup',
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const TopupScreen()),
      ),
      GoRoute(
        path: '/wallet/history',
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const WalletHistoryScreen()),
      ),
      GoRoute(
        path: '/security',
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const SecurityCenterScreen()),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (context, state) =>
            _fadeSlidePage(state, const NotificationsScreen()),
      ),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.games,
                builder: (context, state) =>
                    AllGamesScreen(initialCategory: state.extra as String?),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.orders,
                builder: (context, state) => const OrderHistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
