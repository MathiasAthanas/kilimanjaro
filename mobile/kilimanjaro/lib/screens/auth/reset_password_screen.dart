import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/auth/auth_recovery_layout.dart';
import '../../widgets/auth/password_strength.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_text_field.dart';

const _kSteps = [
  AuthStepDef(label: 'Email', icon: Icons.mail_outline_rounded),
  AuthStepDef(label: 'Verify', icon: Icons.verified_user_outlined),
  AuthStepDef(label: 'Reset', icon: Icons.lock_reset_rounded),
];

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.email,
    required this.otp,
  });

  final String email;
  final String otp;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _passwordController.addListener(_refresh);
    _confirmController.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _passwordController.removeListener(_refresh);
    _confirmController.removeListener(_refresh);
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool get _passwordsMatch =>
      _confirmController.text.isNotEmpty &&
      _confirmController.text == _passwordController.text;

  bool get _canSubmit =>
      _passwordsMatch && _passwordController.text.length >= 8;

  Future<void> _submit() async {
    await ref
        .read(resetPasswordProvider.notifier)
        .reset(widget.email, widget.otp, _passwordController.text);
    final state = ref.read(resetPasswordProvider);
    if (state.isReset && mounted) {
      ref
          .read(snackbarProvider.notifier)
          .show('Password reset successfully. Sign in below.');
      AppRouter.go(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(resetPasswordProvider);
    final confirmText = _confirmController.text;
    final hasConfirmError =
        confirmText.isNotEmpty && !_passwordsMatch;

    return AuthRecoveryLayout(
      title: 'Create New Password',
      steps: _kSteps,
      currentStep: 2,
      illustration: const AuthIllustration(
        icon: Icons.lock_outline_rounded,
        color: AppColors.accentIndigo,
        badgeIcon: Icons.key_rounded,
        badgeColor: AppColors.accentAmber,
      ),
      children: [
        Text(
          'Secure your account',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Choose a strong password that you haven\'t used before.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppColors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 24),
        // ── New password ───────────────────────────────────────────────────
        KSTextField(
          controller: _passwordController,
          label: 'New Password',
          hint: 'At least 8 characters',
          iconAsset: 'assets/icons/lock.svg',
          obscureText: _obscurePassword,
          textInputAction: TextInputAction.next,
          trailing: IconButton(
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
            icon: Icon(
              _obscurePassword
                  ? Icons.visibility_rounded
                  : Icons.visibility_off_rounded,
              size: 20,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        const SizedBox(height: 10),
        PasswordStrength(password: _passwordController.text),
        const SizedBox(height: 16),
        // ── Confirm password ───────────────────────────────────────────────
        KSTextField(
          controller: _confirmController,
          label: 'Confirm Password',
          iconAsset: 'assets/icons/lock.svg',
          obscureText: _obscureConfirm,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) {
            if (_canSubmit && !state.isResetting) _submit();
          },
          trailing: IconButton(
            onPressed: () =>
                setState(() => _obscureConfirm = !_obscureConfirm),
            icon: Icon(
              _obscureConfirm
                  ? Icons.visibility_rounded
                  : Icons.visibility_off_rounded,
              size: 20,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        if (hasConfirmError) ...[
          const SizedBox(height: 6),
          _FieldError(message: 'Passwords do not match'),
        ],
        const SizedBox(height: 18),
        // ── Requirements card ──────────────────────────────────────────────
        _RequirementsCard(
          password: _passwordController.text,
          passwordsMatch: _passwordsMatch,
          hasConfirmInput: _confirmController.text.isNotEmpty,
        ),
        if (state.error != null) ...[
          const SizedBox(height: 12),
          _AuthErrorBanner(message: state.error!),
        ],
        const SizedBox(height: 24),
        KSButton(
          label: 'Reset Password',
          isLoading: state.isResetting,
          icon: const Icon(Icons.lock_reset_rounded, color: AppColors.white),
          onPressed: _canSubmit && !state.isResetting ? _submit : null,
        ),
      ],
    );
  }
}

// ── Supporting widgets ────────────────────────────────────────────────────────

class _RequirementsCard extends StatelessWidget {
  const _RequirementsCard({
    required this.password,
    required this.passwordsMatch,
    required this.hasConfirmInput,
  });

  final String password;
  final bool passwordsMatch;
  final bool hasConfirmInput;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Password requirements',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 10),
          _Requirement(
            label: 'At least 8 characters',
            met: password.length >= 8,
          ),
          _Requirement(
            label: 'Contains uppercase letter',
            met: password.contains(RegExp(r'[A-Z]')),
          ),
          _Requirement(
            label: 'Contains a number',
            met: password.contains(RegExp(r'\d')),
          ),
          _Requirement(
            label: 'Passwords match',
            met: passwordsMatch,
            // Only show failure state once user has started typing in confirm
            showFailure: hasConfirmInput,
          ),
        ],
      ),
    );
  }
}

class _Requirement extends StatelessWidget {
  const _Requirement({
    required this.label,
    required this.met,
    this.showFailure = true,
  });

  final String label;
  final bool met;
  final bool showFailure;

  @override
  Widget build(BuildContext context) {
    final isNeutral = !met && !showFailure;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            met
                ? Icons.check_circle_rounded
                : isNeutral
                ? Icons.radio_button_unchecked_rounded
                : Icons.cancel_rounded,
            size: 18,
            color: met
                ? AppColors.accentEmerald
                : isNeutral
                ? AppColors.textMuted
                : AppColors.accentRose,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: met
                  ? AppColors.textPrimary
                  : isNeutral
                  ? AppColors.textMuted
                  : AppColors.accentRose,
              fontWeight: met ? FontWeight.w600 : FontWeight.w400,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldError extends StatelessWidget {
  const _FieldError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          Icons.error_outline_rounded,
          size: 14,
          color: AppColors.accentRose,
        ),
        const SizedBox(width: 6),
        Text(
          message,
          style: const TextStyle(
            color: AppColors.accentRose,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
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
