import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_text_field.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _localAuth = LocalAuthentication();

  bool _obscure = true;
  bool _biometricsAvailable = false;
  bool _useFaceId = false;

  bool get _canSubmit =>
      _identifierController.text.trim().isNotEmpty &&
      _passwordController.text.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _identifierController.addListener(_refresh);
    _passwordController.addListener(_refresh);
    _checkBiometrics();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _checkBiometrics() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      if (!canCheck || !mounted) return;
      final types = await _localAuth.getAvailableBiometrics();
      if (mounted) {
        setState(() {
          _biometricsAvailable = types.isNotEmpty;
          _useFaceId = types.contains(BiometricType.face);
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _identifierController.removeListener(_refresh);
    _passwordController.removeListener(_refresh);
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final result = await ref
        .read(authControllerProvider.notifier)
        .login(_identifierController.text.trim(), _passwordController.text);
    if (result == null || !mounted) return;
    ref
        .read(snackbarProvider.notifier)
        .show('Welcome back, ${result.user.name}');
    AppRouter.go(context, '/shell/${result.user.role.shellSegment}/home');
  }

  Future<void> _tryBiometric() async {
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Sign in to Kilimanjaro School Portal',
      );
      if (!authenticated || !mounted) return;
      ref.read(snackbarProvider.notifier).show(
        'Biometric sign-in will be available after your first login.',
      );
    } catch (_) {}
  }

  Future<void> _contactRegistry() async {
    final uri = Uri.parse('tel:+255000000000');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final loading = authState is AuthLoading;
    final error = authState is AuthError ? authState.message : null;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.darkBg,
        resizeToAvoidBottomInset: true,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              // ── Brand zone (dark background, shrinks when keyboard opens) ──
              AnimatedContainer(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                height: keyboardOpen ? 88 : 218,
                child: _BrandZone(compact: keyboardOpen),
              ),
              // ── Form card (white, rounded top corners) ────────────────────
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppColors.offWhite,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(32),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x30000000),
                        blurRadius: 40,
                        offset: Offset(0, -10),
                      ),
                    ],
                  ),
                  child: ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(24, 10, 24, 40),
                    children: [
                      // ── Drag pill ─────────────────────────────────────────
                      Center(
                        child: Container(
                          width: 38,
                          height: 4,
                          margin: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      // ── Heading ───────────────────────────────────────────
                      Text(
                        'Sign in',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.5,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Enter your portal credentials to continue',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 26),
                      // ── Identifier ────────────────────────────────────────
                      KSTextField(
                        controller: _identifierController,
                        label: 'Email or Registration Number',
                        hint: 'KS-2024-00142 or staff@ks.ac.tz',
                        iconAsset: 'assets/icons/mail.svg',
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),
                      // ── Password ──────────────────────────────────────────
                      KSTextField(
                        controller: _passwordController,
                        label: 'Password',
                        hint: 'Enter your password',
                        iconAsset: 'assets/icons/lock.svg',
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) {
                          if (!loading && _canSubmit) _submit();
                        },
                        trailing: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_rounded
                                : Icons.visibility_off_rounded,
                            size: 20,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () =>
                              AppRouter.go(context, '/forgot-password'),
                          child: const Text('Forgot Password?'),
                        ),
                      ),
                      // ── Error banner ──────────────────────────────────────
                      if (error != null) ...[
                        const SizedBox(height: 4),
                        _AuthErrorBanner(message: error),
                        const SizedBox(height: 10),
                      ],
                      // ── Sign In button ────────────────────────────────────
                      KSButton(
                        label: 'Sign In',
                        isLoading: loading,
                        icon: const Icon(
                          Icons.arrow_forward_rounded,
                          color: AppColors.white,
                        ),
                        onPressed: loading || !_canSubmit ? null : _submit,
                      ),
                      // ── Biometrics ────────────────────────────────────────
                      if (_biometricsAvailable) ...[
                        const SizedBox(height: 12),
                        _BiometricButton(
                          useFaceId: _useFaceId,
                          onPressed: _tryBiometric,
                        ),
                      ],
                      const SizedBox(height: 30),
                      // ── Footer ────────────────────────────────────────────
                      _ContactRegistryFooter(onTap: _contactRegistry),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Brand zone ────────────────────────────────────────────────────────────────

class _BrandZone extends StatelessWidget {
  const _BrandZone({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Decorative radial glow — top right
        Positioned(
          right: -50,
          top: -60,
          child: _GlowOrb(
            size: 220,
            color: AppColors.skyBlue700.withValues(alpha: 0.28),
          ),
        ),
        // Decorative radial glow — bottom left
        Positioned(
          left: -40,
          bottom: -20,
          child: _GlowOrb(
            size: 140,
            color: AppColors.accentIndigo.withValues(alpha: 0.16),
          ),
        ),
        // Small accent dot
        Positioned(
          right: 48,
          bottom: 40,
          child: _GlowOrb(
            size: 64,
            color: AppColors.skyBlue400.withValues(alpha: 0.14),
          ),
        ),
        // Brand content — animates between full and compact
        Align(
          alignment: Alignment.center,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: compact
                ? _CompactBrand(key: const ValueKey('compact'))
                : _FullBrand(key: const ValueKey('full')),
          ),
        ),
      ],
    );
  }
}

class _FullBrand extends StatelessWidget {
  const _FullBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Logo
        Container(
          width: 74,
          height: 74,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AppColors.skyBlue900.withValues(alpha: 0.45),
                blurRadius: 36,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: Image.asset('assets/images/kilimanjaro_logo_icon.png'),
        ),
        const SizedBox(height: 18),
        // School name
        Text(
          'KILIMANJARO SCHOOLS',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.2,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          'Academic Management Portal',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.skyBlue300,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}

class _CompactBrand extends StatelessWidget {
  const _CompactBrand({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Image.asset('assets/images/kilimanjaro_logo_icon.png'),
        ),
        const SizedBox(width: 10),
        Text(
          'KILIMANJARO SCHOOLS',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.4,
          ),
        ),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
        ),
      ),
    );
  }
}

// ── Supporting widgets ────────────────────────────────────────────────────────

class _AuthErrorBanner extends StatelessWidget {
  const _AuthErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.accentRose.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accentRose.withValues(alpha: 0.24)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.accentRose,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.accentRose,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BiometricButton extends StatelessWidget {
  const _BiometricButton({required this.useFaceId, required this.onPressed});

  final bool useFaceId;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(
        useFaceId ? Icons.face_rounded : Icons.fingerprint_rounded,
        size: 22,
      ),
      label: Text(
        useFaceId ? 'Sign in with Face ID' : 'Sign in with Fingerprint',
      ),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 52),
        foregroundColor: AppColors.skyBlue600,
        side: const BorderSide(color: AppColors.skyBlue200),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
    );
  }
}

class _ContactRegistryFooter extends StatelessWidget {
  const _ContactRegistryFooter({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textMuted,
            ),
            children: [
              const TextSpan(text: 'Having trouble? '),
              const TextSpan(
                text: 'Contact School Registry',
                style: TextStyle(
                  color: AppColors.skyBlue600,
                  fontWeight: FontWeight.w700,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.skyBlue300,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
