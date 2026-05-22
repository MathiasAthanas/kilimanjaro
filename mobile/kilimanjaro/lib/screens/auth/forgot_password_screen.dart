import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/auth/auth_recovery_layout.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_text_field.dart';

const _kSteps = [
  AuthStepDef(label: 'Email', icon: Icons.mail_outline_rounded),
  AuthStepDef(label: 'Verify', icon: Icons.verified_user_outlined),
  AuthStepDef(label: 'Reset', icon: Icons.lock_reset_rounded),
];

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailController = TextEditingController();

  bool get _canSubmit => _emailController.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _emailController.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _emailController.removeListener(_refresh);
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    await ref
        .read(forgotPasswordProvider.notifier)
        .requestReset(_emailController.text.trim());
    if (!mounted) return;
    final nextState = ref.read(forgotPasswordProvider);
    if (!nextState.sent) return;
    AppRouter.go(
      context,
      '/otp-verify?email=${Uri.encodeComponent(_emailController.text.trim())}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(forgotPasswordProvider);

    return AuthRecoveryLayout(
      title: 'Account Recovery',
      steps: _kSteps,
      currentStep: 0,
      illustration: const AuthIllustration(
        icon: Icons.mail_outline_rounded,
        color: AppColors.skyBlue500,
        badgeIcon: Icons.lock_outline_rounded,
        badgeColor: AppColors.accentAmber,
      ),
      footer: Center(
        child: TextButton(
          onPressed: () => AppRouter.go(context, '/login'),
          child: const Text('Remember password? Sign in'),
        ),
      ),
      children: [
        Text(
          'Where should we send the code?',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Enter your school email address. If the account exists, you\'ll receive a 6-digit verification code.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppColors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 24),
        KSTextField(
          controller: _emailController,
          label: 'School Email Address',
          hint: 'yourname@ks.ac.tz',
          iconAsset: 'assets/icons/mail.svg',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) {
            if (state.loading || !_canSubmit) return;
            _submit();
          },
        ),
        const SizedBox(height: 10),
        _InfoNote(
          icon: Icons.info_outline_rounded,
          text:
              'We\'ll only send a code if the email matches a registered school account.',
        ),
        if (state.error != null) ...[
          const SizedBox(height: 12),
          _AuthErrorBanner(message: state.error!),
        ],
        const SizedBox(height: 24),
        KSButton(
          label: 'Send OTP',
          isLoading: state.loading,
          icon: const Icon(Icons.send_rounded, color: AppColors.white),
          onPressed: state.loading || !_canSubmit ? null : _submit,
        ),
      ],
    );
  }
}

// ── Supporting widgets ────────────────────────────────────────────────────────

class _InfoNote extends StatelessWidget {
  const _InfoNote({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.skyBlue50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.skyBlue100),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.skyBlue500),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.skyBlue700,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
