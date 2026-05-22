import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';

class KSSnackbarOverlay extends ConsumerWidget {
  const KSSnackbarOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final item = ref.watch(snackbarProvider);
    if (item == null) return const SizedBox.shrink();

    return Positioned(
      left: 16,
      right: 16,
      bottom: 120,
      child: Dismissible(
        key: ValueKey(item.id),
        onDismissed: (_) => ref.read(snackbarProvider.notifier).clear(),
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: item.isError ? AppColors.error : AppColors.textPrimary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              item.message,
              style: const TextStyle(color: AppColors.white),
            ),
          ),
        ),
      ),
    );
  }
}
