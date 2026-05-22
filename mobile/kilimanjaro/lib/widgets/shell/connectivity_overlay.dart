import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/connectivity_provider.dart';
import '../../core/theme/app_colors.dart';

class ConnectivityOverlay extends ConsumerWidget {
  const ConnectivityOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivity = ref.watch(connectivityProvider);
    if (connectivity.status == ConnectivityStatus.online) {
      return const SizedBox.shrink();
    }

    final restored = connectivity.status == ConnectivityStatus.restored;
    final bg = restored ? AppColors.accentEmerald : AppColors.textPrimary;
    final label =
        restored ? 'Connection restored' : 'No internet connection';

    return Positioned(
      top: 12,
      left: 16,
      right: 16,
      child: SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            label,
            style: TextStyle(color: AppColors.white),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
