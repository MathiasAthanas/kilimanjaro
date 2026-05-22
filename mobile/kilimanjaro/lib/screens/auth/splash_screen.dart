import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  late final Future<_LaunchGateResult> _launchGateFuture;

  @override
  void initState() {
    super.initState();
    _launchGateFuture = _resolveLaunchState();
    Future<void>.delayed(const Duration(milliseconds: 1800), _goNext);
  }

  Future<_LaunchGateResult> _resolveLaunchState() async {
    final user = await ref.read(authServiceProvider).getCurrentUser();
    final packageInfo = await PackageInfo.fromPlatform();
    final currentVersion = packageInfo.version;
    final minimumVersion = AppConfig.minRequiredVersion;

    return _LaunchGateResult(
      user: user,
      currentVersion: currentVersion,
      minimumVersion: minimumVersion,
      needsForceUpdate: _compareVersions(currentVersion, minimumVersion) < 0,
    );
  }

  int _compareVersions(String current, String required) {
    List<int> parse(String value) => value
        .split('.')
        .map((part) => int.tryParse(part.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
        .toList();

    final a = parse(current);
    final b = parse(required);
    final max = a.length > b.length ? a.length : b.length;
    for (var index = 0; index < max; index++) {
      final currentPart = index < a.length ? a[index] : 0;
      final requiredPart = index < b.length ? b[index] : 0;
      if (currentPart != requiredPart) {
        return currentPart.compareTo(requiredPart);
      }
    }
    return 0;
  }

  Future<void> _goNext() async {
    final result = await _launchGateFuture;
    if (!mounted) return;
    if (result.needsForceUpdate) {
      AppRouter.go(
        context,
        '/force-update?current=${Uri.encodeComponent(result.currentVersion)}&required=${Uri.encodeComponent(result.minimumVersion)}',
      );
      return;
    }
    if (result.user == null) {
      AppRouter.go(context, '/login');
      return;
    }
    AppRouter.go(context, '/shell/${result.user!.role.shellSegment}/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.heroGradient),
        child: Stack(
          children: [
            Positioned(
              top: 110,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 216,
                  height: 216,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.22),
                      width: 2.8,
                    ),
                  ),
                ).animate(onPlay: (controller) => controller.repeat()).scale(
                      begin: const Offset(0.96, 0.96),
                      end: const Offset(1.03, 1.03),
                      duration: 1800.ms,
                    ),
              ),
            ),
            Positioned.fill(
              child: Align(
                alignment: const Alignment(0, -0.1),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 138,
                      height: 138,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.10),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.28),
                          width: 2,
                        ),
                      ),
                      child: Image.asset('assets/images/kilimanjaro_logo_icon.png'),
                    ).animate().scale(
                          duration: 800.ms,
                          curve: Curves.easeOutBack,
                        ).fadeIn(),
                    const SizedBox(height: 26),
                    const Text(
                      'KILIMANJARO',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        letterSpacing: 6,
                        fontWeight: FontWeight.w600,
                      ),
                    ).animate().fadeIn(delay: 200.ms),
                    const SizedBox(height: 12),
                    const Text(
                      'Schools',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w700,
                      ),
                    ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.2, end: 0),
                    const SizedBox(height: 10),
                    Text(
                      'Aspiring to Greatness',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontSize: 15,
                      ),
                    ).animate().fadeIn(delay: 500.ms),
                    const SizedBox(height: 36),
                    Container(
                      width: 84,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: 28,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        )
                            .animate(onPlay: (controller) => controller.repeat())
                            .moveX(begin: -2, end: 54, duration: 900.ms),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LaunchGateResult {
  const _LaunchGateResult({
    required this.user,
    required this.currentVersion,
    required this.minimumVersion,
    required this.needsForceUpdate,
  });

  final AuthUser? user;
  final String currentVersion;
  final String minimumVersion;
  final bool needsForceUpdate;
}
