import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../common/ks_back_button.dart';

// ── Step definition ───────────────────────────────────────────────────────────

class AuthStepDef {
  const AuthStepDef({required this.label, required this.icon});
  final String label;
  final IconData icon;
}

// ── Layout ────────────────────────────────────────────────────────────────────

class AuthRecoveryLayout extends StatelessWidget {
  const AuthRecoveryLayout({
    super.key,
    required this.title,
    required this.steps,
    required this.currentStep,
    required this.illustration,
    required this.children,
    this.footer,
    this.stickyBottom,
    this.onBack,
  });

  final String title;
  final List<AuthStepDef> steps;
  final int currentStep;
  final Widget illustration;
  final List<Widget> children;
  final Widget? footer;

  /// Placed below the scrollable content area — always visible, not scrolled.
  /// Use this for the custom numpad on the OTP screen.
  final Widget? stickyBottom;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: const Color(0xFFF3F6FF),
        body: SafeArea(
          child: Column(
            children: [
              // ── Navigation bar ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 20, 0),
                child: Row(
                  children: [
                    KSBackButton(
                      onTap: onBack,
                      foregroundColor: AppColors.textPrimary,
                      backgroundColor: AppColors.white,
                    ),
                    Expanded(
                      child: Text(
                        title,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    // Balance the back-button width so the title is centred
                    const SizedBox(width: 42),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // ── Progress stepper ───────────────────────────────────────────
              AuthProgressStepper(steps: steps, currentStep: currentStep),
              const SizedBox(height: 28),
              // ── Illustration ───────────────────────────────────────────────
              illustration,
              const SizedBox(height: 24),
              // ── Content card ───────────────────────────────────────────────
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(32),
                    ),
                  ),
                  child: Column(
                    children: [
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          children: [
                            ...children,
                            if (footer != null) ...[
                              const SizedBox(height: 16),
                              footer!,
                            ],
                            const SizedBox(height: 20),
                          ],
                        ),
                      ),
                      if (stickyBottom != null) stickyBottom!,
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

// ── Progress stepper ──────────────────────────────────────────────────────────

class AuthProgressStepper extends StatelessWidget {
  const AuthProgressStepper({
    super.key,
    required this.steps,
    required this.currentStep,
  });

  final List<AuthStepDef> steps;
  final int currentStep;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 36),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (int i = 0; i < steps.length; i++) ...[
            _StepNode(
              step: steps[i],
              isDone: i < currentStep,
              isActive: i == currentStep,
            ),
            if (i < steps.length - 1)
              Expanded(child: _StepConnector(done: i < currentStep)),
          ],
        ],
      ),
    );
  }
}

class _StepNode extends StatelessWidget {
  const _StepNode({
    required this.step,
    required this.isDone,
    required this.isActive,
  });

  final AuthStepDef step;
  final bool isDone;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOutCubic,
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: isDone
                ? AppColors.accentEmerald
                : isActive
                ? AppColors.skyBlue500
                : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(
              color: isDone
                  ? AppColors.accentEmerald
                  : isActive
                  ? AppColors.skyBlue500
                  : AppColors.border,
              width: 2,
            ),
            boxShadow: isDone
                ? [
                    BoxShadow(
                      color: AppColors.accentEmerald.withValues(alpha: 0.28),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : isActive
                ? [
                    BoxShadow(
                      color: AppColors.skyBlue500.withValues(alpha: 0.38),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Icon(
            isDone ? Icons.check_rounded : step.icon,
            size: 20,
            color: isDone || isActive ? AppColors.white : AppColors.textMuted,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          step.label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive
                ? AppColors.skyBlue600
                : isDone
                ? AppColors.accentEmerald
                : AppColors.textMuted,
          ),
        ),
      ],
    );
  }
}

class _StepConnector extends StatelessWidget {
  const _StepConnector({required this.done});
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Align the line with the vertical centre of the 42px circles above
      padding: const EdgeInsets.only(bottom: 22),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 350),
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: done ? AppColors.accentEmerald : AppColors.border,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}

// ── Illustration ──────────────────────────────────────────────────────────────

class AuthIllustration extends StatelessWidget {
  const AuthIllustration({
    super.key,
    required this.icon,
    required this.color,
    this.badgeIcon,
    this.badgeColor,
  });

  final IconData icon;
  final Color color;
  final IconData? badgeIcon;
  final Color? badgeColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 114,
      height: 114,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 114,
            height: 114,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
          ),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 38, color: color),
          ),
          if (badgeIcon != null)
            Positioned(
              right: 6,
              bottom: 6,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: badgeColor ?? AppColors.accentEmerald,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.white, width: 2.5),
                ),
                child: Icon(badgeIcon!, size: 14, color: AppColors.white),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Custom numpad (OTP screen) ────────────────────────────────────────────────

class AuthNumpad extends StatelessWidget {
  const AuthNumpad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
  });

  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;

  static const _rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.white,
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: _rows.map((row) {
          return Row(
            children: row.map((label) {
              if (label.isEmpty) {
                return const Expanded(child: SizedBox(height: 54));
              }
              return Expanded(
                child: _NumKey(
                  label: label,
                  onTap: label == '⌫' ? onBackspace : () => onDigit(label),
                  isDelete: label == '⌫',
                ),
              );
            }).toList(),
          );
        }).toList(),
      ),
    );
  }
}

class _NumKey extends StatelessWidget {
  const _NumKey({
    required this.label,
    required this.onTap,
    this.isDelete = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool isDelete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: Material(
        color: isDelete ? AppColors.surface : AppColors.offWhite,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: SizedBox(
            height: 54,
            child: Center(
              child: isDelete
                  ? const Icon(
                      Icons.backspace_outlined,
                      size: 22,
                      color: AppColors.textSecondary,
                    )
                  : Text(
                      label,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
