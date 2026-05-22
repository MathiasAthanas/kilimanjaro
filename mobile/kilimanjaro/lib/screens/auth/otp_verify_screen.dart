import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pinput/pinput.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/auth/auth_recovery_layout.dart';
import '../../widgets/common/ks_button.dart';

const _kSteps = [
  AuthStepDef(label: 'Email', icon: Icons.mail_outline_rounded),
  AuthStepDef(label: 'Verify', icon: Icons.verified_user_outlined),
  AuthStepDef(label: 'Reset', icon: Icons.lock_reset_rounded),
];

class OtpVerifyScreen extends ConsumerStatefulWidget {
  const OtpVerifyScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<OtpVerifyScreen> createState() => _OtpVerifyScreenState();
}

class _OtpVerifyScreenState extends ConsumerState<OtpVerifyScreen> {
  final _pinController = TextEditingController();
  late Timer _expiryTimer;
  late Timer _resendTimer;

  bool _isVerifying = false;

  @override
  void initState() {
    super.initState();
    _pinController.addListener(_refresh);
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      ref.read(otpProvider.notifier).decrementExpiry();
    });
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      ref.read(otpProvider.notifier).decrementResend();
    });
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _pinController.removeListener(_refresh);
    _pinController.dispose();
    _expiryTimer.cancel();
    _resendTimer.cancel();
    super.dispose();
  }

  Future<void> _verify(String value) async {
    if (_isVerifying) return;
    setState(() => _isVerifying = true);
    await ref.read(otpProvider.notifier).verify(widget.email, value);
    if (!mounted) return;
    setState(() => _isVerifying = false);
    final state = ref.read(otpProvider);
    if (state.isVerified) {
      AppRouter.go(
        context,
        '/reset-password?email=${Uri.encodeComponent(widget.email)}&otp=$value',
      );
    } else {
      // Clear pin on failure so user can re-enter
      _pinController.clear();
    }
  }

  // Mask the email for privacy: name@domain.com → n***@domain.com
  String get _maskedEmail {
    final parts = widget.email.split('@');
    if (parts.length != 2) return widget.email;
    final name = parts[0];
    final masked = name.length > 1 ? '${name[0]}***' : name;
    return '$masked@${parts[1]}';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(otpProvider);
    final minutes = (state.expiryCountdown ~/ 60).toString().padLeft(2, '0');
    final seconds = (state.expiryCountdown % 60).toString().padLeft(2, '0');
    final timerColor = state.expiryCountdown < 120
        ? AppColors.accentRose
        : state.expiryCountdown < 300
        ? AppColors.accentAmber
        : AppColors.skyBlue600;

    final pinTheme = PinTheme(
      width: 48,
      height: 56,
      textStyle: Theme.of(context).textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
    );

    return AuthRecoveryLayout(
      title: 'Verify Email',
      steps: _kSteps,
      currentStep: 1,
      illustration: const AuthIllustration(
        icon: Icons.mark_email_unread_rounded,
        color: AppColors.skyBlue500,
        badgeIcon: Icons.check_rounded,
        badgeColor: AppColors.accentEmerald,
      ),
      children: [
        Text(
          'Check your inbox',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        RichText(
          text: TextSpan(
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
              height: 1.5,
            ),
            children: [
              const TextSpan(text: 'Enter the 6-digit code sent to '),
              TextSpan(
                text: _maskedEmail,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // ── PIN input ──────────────────────────────────────────────────────
        Center(
          child: Pinput(
            length: 6,
            controller: _pinController,
            keyboardType: TextInputType.number,
            autofocus: true,
            defaultPinTheme: pinTheme,
            focusedPinTheme: pinTheme.copyDecorationWith(
              border: Border.all(color: AppColors.skyBlue500, width: 2),
              color: AppColors.skyBlue50,
            ),
            submittedPinTheme: pinTheme.copyDecorationWith(
              border: Border.all(color: AppColors.accentEmerald, width: 1.5),
              color: AppColors.accentEmerald.withValues(alpha: 0.06),
            ),
            errorPinTheme: pinTheme.copyDecorationWith(
              border: Border.all(color: AppColors.accentRose, width: 1.5),
            ),
            showCursor: true,
            onCompleted: _verify,
          ),
        ),
        const SizedBox(height: 20),
        // ── Timer ──────────────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(Icons.timer_outlined, size: 18, color: timerColor),
              const SizedBox(width: 8),
              const Text('Code expires in'),
              const Spacer(),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  color: timerColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
                child: Text('$minutes:$seconds'),
              ),
            ],
          ),
        ),
        if (state.error != null) ...[
          const SizedBox(height: 12),
          _AuthErrorBanner(message: state.error!),
        ],
        const SizedBox(height: 16),
        KSButton(
          label: 'Verify Code',
          isLoading: _isVerifying || state.isVerifying,
          icon: const Icon(Icons.verified_rounded, color: AppColors.white),
          onPressed: _pinController.text.length == 6
              ? () => _verify(_pinController.text)
              : null,
        ),
        const SizedBox(height: 4),
        // ── Resend + edit email ────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: () => AppRouter.go(context, '/forgot-password'),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Edit email'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.textSecondary,
                textStyle: const TextStyle(fontSize: 13),
              ),
            ),
            TextButton(
              onPressed: state.resendCountdown == 0
                  ? () => ref.read(otpProvider.notifier).resetResend()
                  : null,
              child: Text(
                state.resendCountdown == 0
                    ? 'Resend Code'
                    : 'Resend in ${state.resendCountdown}s',
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ],
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
        border: Border.all(color: AppColors.accentRose.withValues(alpha: 0.22)),
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
