import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../l10n/generated/app_localizations.dart';
import '../branding/brand_icon.dart';
import '../notifications/notification_watcher.dart';
import '../widgets/app_bottom_nav.dart';
import '../widgets/page_motion.dart';

/// Bottom-nav shell for the four primary destinations. Each branch keeps
/// its own navigation stack/scroll position via [StatefulShellRoute] —
/// switching tabs never rebuilds the others from scratch.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    // Keeps the local-notification poll running for as long as any
    // authenticated tab is on screen — see notification_watcher.dart.
    ref.watch(notificationWatcherProvider);

    return Scaffold(
      body: TabReveal(
        index: navigationShell.currentIndex,
        child: navigationShell,
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) {
          HapticFeedback.selectionClick();
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        items: [
          AppNavItem(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            label: l10n.navHome,
            brandSymbol: BrandSymbol.home,
          ),
          AppNavItem(
            icon: Icons.sports_esports_outlined,
            selectedIcon: Icons.sports_esports_rounded,
            label: l10n.navGames,
            brandSymbol: BrandSymbol.catalog,
          ),
          AppNavItem(
            icon: Icons.receipt_long_outlined,
            selectedIcon: Icons.receipt_long_rounded,
            label: l10n.navOrders,
            brandSymbol: BrandSymbol.orders,
          ),
          AppNavItem(
            icon: Icons.person_outline_rounded,
            selectedIcon: Icons.person_rounded,
            label: l10n.navProfile,
            brandSymbol: BrandSymbol.profile,
          ),
        ],
      ),
    );
  }
}
