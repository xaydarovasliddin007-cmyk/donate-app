import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/complete_registration_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/games/domain/game.dart';
import '../../features/games/domain/product.dart';
import '../../features/games/presentation/all_games_screen.dart';
import '../../features/games/presentation/game_details_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/orders/presentation/checkout_screen.dart';
import '../../features/orders/presentation/purchase_flow_screen.dart';
import '../../features/orders/presentation/order_history_screen.dart';
import '../../features/orders/presentation/order_status_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/profile/presentation/security_center_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/topup/presentation/topup_screen.dart';
import '../../features/wallet/presentation/wallet_history_screen.dart';
import '../theme/app_motion.dart';
import '../theme/reduce_motion_controller.dart';
import '../widgets/page_motion.dart';
import 'app_shell.dart';

abstract final class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const registerComplete = '/register/complete';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/forgot-password/reset';
  static const home = '/home';
  static const games = '/catalog';
  static const orders = '/orders';
  static const profile = '/profile';
}

/// Page pushes share the same soft depth and lift as the card entrances.
CustomTransitionPage<void> _fadeSlidePage(
  BuildContext context,
  GoRouterState state,
  Widget child,
) {
  final reduceMotion =
      ProviderScope.containerOf(
        context,
        listen: false,
      ).read(reduceMotionProvider) ||
      MediaQuery.disableAnimationsOf(context);
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: reduceMotion ? Duration.zero : AppMotion.route,
    reverseTransitionDuration: reduceMotion ? Duration.zero : AppMotion.medium,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return Consumer(
        builder: (context, ref, _) => BrandPageTransition(
          animation: animation,
          secondaryAnimation: secondaryAnimation,
          reduceMotion: ref.watch(reduceMotionProvider),
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
            _fadeSlidePage(context, state, const LoginScreen()),
      ),
      GoRoute(
        path: AppRoutes.register,
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const RegisterScreen()),
      ),
      GoRoute(
        path: AppRoutes.registerComplete,
        pageBuilder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return _fadeSlidePage(
            context,
            state,
            CompleteRegistrationScreen(
              email: extra['email']! as String,
              displayName: extra['displayName'] as String?,
            ),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const ForgotPasswordScreen()),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        pageBuilder: (context, state) => _fadeSlidePage(
          context,
          state,
          ResetPasswordScreen(email: state.extra! as String),
        ),
      ),

      GoRoute(
        path: '/games/:gameId',
        pageBuilder: (context, state) => _fadeSlidePage(
          context,
          state,
          GameDetailsScreen(gameId: state.pathParameters['gameId']!),
        ),
      ),
      GoRoute(
        path: '/checkout/player-info',
        pageBuilder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return _fadeSlidePage(
            context,
            state,
            PurchaseFlowScreen(
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
            context,
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
          context,
          state,
          OrderStatusScreen(orderId: state.pathParameters['orderId']!),
        ),
      ),
      GoRoute(
        path: '/wallet/topup',
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const TopupScreen()),
      ),
      GoRoute(
        path: '/wallet/history',
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const WalletHistoryScreen()),
      ),
      GoRoute(
        path: '/security',
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const SecurityCenterScreen()),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (context, state) =>
            _fadeSlidePage(context, state, const NotificationsScreen()),
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
