import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../l10n/generated/app_localizations.dart';
import '../widgets/app_bottom_nav.dart';

/// Bottom-nav shell for the three primary destinations. Each branch keeps
/// its own navigation stack/scroll position via [StatefulShellRoute] —
/// switching tabs never rebuilds the others from scratch.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: AppBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) =>
            navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex),
        items: [
          AppNavItem(icon: Icons.home_outlined, selectedIcon: Icons.home_rounded, label: l10n.navHome),
          AppNavItem(
            icon: Icons.receipt_long_outlined,
            selectedIcon: Icons.receipt_long_rounded,
            label: l10n.navOrders,
          ),
          AppNavItem(icon: Icons.person_outline_rounded, selectedIcon: Icons.person_rounded, label: l10n.navProfile),
        ],
      ),
    );
  }
}
