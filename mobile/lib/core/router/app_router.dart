import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/games/domain/game.dart';
import '../../features/games/domain/product.dart';
import '../../features/games/presentation/game_details_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/orders/presentation/checkout_screen.dart';
import '../../features/orders/presentation/order_history_screen.dart';
import '../../features/orders/presentation/order_status_screen.dart';
import '../../features/orders/presentation/player_info_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import 'app_shell.dart';

abstract final class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const home = '/home';
  static const orders = '/orders';
  static const profile = '/profile';
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: AppRoutes.splash,
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: AppRoutes.onboarding, builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: AppRoutes.login, builder: (context, state) => const LoginScreen()),
      GoRoute(path: AppRoutes.register, builder: (context, state) => const RegisterScreen()),

      GoRoute(
        path: '/games/:gameId',
        builder: (context, state) => GameDetailsScreen(gameId: state.pathParameters['gameId']!),
      ),
      GoRoute(
        path: '/checkout/player-info',
        builder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return PlayerInfoScreen(game: extra['game']! as Game, product: extra['product']! as Product);
        },
      ),
      GoRoute(
        path: '/checkout/confirm',
        builder: (context, state) {
          final extra = state.extra! as Map<String, Object?>;
          return CheckoutScreen(
            game: extra['game']! as Game,
            product: extra['product']! as Product,
            playerId: extra['playerId']! as String,
            serverId: extra['serverId']! as String,
          );
        },
      ),
      GoRoute(
        path: '/orders/:orderId',
        builder: (context, state) => OrderStatusScreen(orderId: state.pathParameters['orderId']!),
      ),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: AppRoutes.home, builder: (context, state) => const HomeScreen())]),
          StatefulShellBranch(
            routes: [GoRoute(path: AppRoutes.orders, builder: (context, state) => const OrderHistoryScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: AppRoutes.profile, builder: (context, state) => const ProfileScreen())],
          ),
        ],
      ),
    ],
  );
});
