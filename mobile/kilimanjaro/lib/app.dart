import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/network/session_bus.dart';
import 'core/notifications/push_provider.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/school_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class KilimanjaroApp extends ConsumerStatefulWidget {
  const KilimanjaroApp({super.key});

  @override
  ConsumerState<KilimanjaroApp> createState() => _KilimanjaroAppState();
}

class _KilimanjaroAppState extends ConsumerState<KilimanjaroApp> {
  StreamSubscription<SessionEvent>? _sessionSub;

  @override
  void initState() {
    super.initState();
    // When token refresh fails anywhere in the app, the network layer signals
    // an expired session here — reset auth state and return to login exactly
    // once, regardless of how many requests failed.
    _sessionSub = SessionBus.instance.stream.listen((event) {
      if (event == SessionEvent.expired && mounted) {
        ref.read(authControllerProvider.notifier).logout();
        ref.read(appRouterProvider).go('/login');
      }
    });

    // Route a tapped push notification to the right screen.
    ref.read(pushCoordinatorProvider).onRoute = (route) {
      if (mounted) ref.read(appRouterProvider).go(route);
    };
  }

  @override
  void dispose() {
    _sessionSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Drive the push lifecycle from authentication: register the device token
    // after login, revoke it on logout.
    ref.listen<AuthState>(authControllerProvider, (previous, next) {
      final coordinator = ref.read(pushCoordinatorProvider);
      if (next is AuthAuthenticated && previous is! AuthAuthenticated) {
        coordinator.onAuthenticated();
      } else if (next is AuthUnauthenticated && previous is AuthAuthenticated) {
        coordinator.onLoggedOut();
      }
    });

    // Keep the working school resolved for multi-school staff.
    ref.watch(activeSchoolIdProvider);

    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Kilimanjaro Schools',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
