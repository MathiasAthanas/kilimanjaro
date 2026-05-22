import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/providers/error_provider.dart';
import '../../core/theme/app_colors.dart';
import '../common/ks_button.dart';

class ErrorBoundary extends ConsumerWidget {
  const ErrorBoundary({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(errorControllerProvider);
    if (!state.hasError) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ColoredBox(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(32, 32, 32, 140),
          child: Column(
            children: [
              const SizedBox(height: 32),
              Container(
                width: 108,
                height: 108,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : AppColors.surface,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.smart_toy_outlined,
                  color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                  size: 54,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Something went wrong',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text(
                'We hit an unexpected error. Don\'t worry, your data is safe.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 28),
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  childrenPadding: EdgeInsets.zero,
                  title: Text(
                    'Show details',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textMuted,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  children: [
                    Container(
                      width: double.infinity,
                      constraints: const BoxConstraints(maxHeight: 120),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkCard : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: SingleChildScrollView(
                        child: Text(
                          state.errorMessage ?? 'Unknown error',
                          style: GoogleFonts.robotoMono(
                            fontSize: 11,
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              KSButton(
                label: 'Try Again',
                onPressed: () => ref.read(errorControllerProvider.notifier).clear(),
              ),
              const SizedBox(height: 12),
              KSButton(
                label: 'Go Home',
                secondary: true,
                onPressed: () {
                  ref.read(errorControllerProvider.notifier).clear();
                  final location = GoRouterState.of(context).uri.toString();
                  final shellMatch = RegExp(r'^/shell/([^/]+)/').firstMatch(location);
                  final segment = shellMatch?.group(1) ?? 'student';
                  context.go('/shell/$segment/home');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
