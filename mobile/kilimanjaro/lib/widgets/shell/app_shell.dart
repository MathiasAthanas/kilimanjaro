import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/back_button_handler.dart';
import '../../core/providers/shell_provider.dart';
import '../../models/auth_user.dart';
import '../common/ks_snackbar.dart';
import 'connectivity_overlay.dart';
import 'error_boundary.dart';
import 'ks_side_drawer.dart';
import 'liquid_glass_nav_bar.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({
    super.key,
    required this.navigationShell,
    required this.role,
  });

  final StatefulNavigationShell navigationShell;
  final UserRole role;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final shell = ref.watch(shellControllerProvider);
    final notifier = ref.read(shellControllerProvider.notifier);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (shell.isDrawerOpen) {
          Navigator.of(context).maybePop();
          return;
        }
        final navigator =
            widget.navigationShell.shellRouteContext.navigatorKey.currentState;
        if (navigator != null && navigator.canPop()) {
          navigator.pop();
          return;
        }
        if (widget.navigationShell.currentIndex != 0) {
          widget.navigationShell.goBranch(0, initialLocation: false);
          notifier.setTabIndex(0);
          return;
        }
        await BackButtonHandler.showExitSheet(context);
      },
      child: Scaffold(
        key: _scaffoldKey,
        extendBody: true,
        onEndDrawerChanged: (isOpened) {
          if (isOpened) {
            notifier.openDrawer();
          } else {
            notifier.closeDrawer();
          }
        },
        endDrawerEnableOpenDragGesture: false,
        endDrawer: KSSideDrawer(
          role: widget.role,
          activeLocation: GoRouterState.of(context).uri.toString(),
          onClose: () => _scaffoldKey.currentState?.closeEndDrawer(),
        ),
        body: Stack(
          fit: StackFit.expand,
          children: [
            widget.navigationShell,
            const ErrorBoundary(),
            const ConnectivityOverlay(),
            const KSSnackbarOverlay(),
          ],
        ),
        bottomNavigationBar: LiquidGlassNavBar(
          role: widget.role,
          currentIndex: widget.navigationShell.currentIndex,
          onItemSelected: (index, route) {
            notifier.setTabIndex(index);
            widget.navigationShell.goBranch(
              index,
              initialLocation: index == widget.navigationShell.currentIndex,
            );
          },
          onMoreTap: () {
            if (shell.isDrawerOpen) {
              Navigator.of(context).maybePop();
            } else {
              _scaffoldKey.currentState?.openEndDrawer();
            }
          },
        ),
      ),
    );
  }
}
