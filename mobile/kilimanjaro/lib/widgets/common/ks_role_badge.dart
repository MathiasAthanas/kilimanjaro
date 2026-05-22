import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import 'ks_chip.dart';

class KSRoleBadge extends StatelessWidget {
  const KSRoleBadge({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context) {
    final color = switch (role) {
      UserRole.student => AppColors.skyBlue500,
      UserRole.parent => AppColors.accentTeal,
      UserRole.teacher => AppColors.accentIndigo,
      UserRole.hod => AppColors.accentAmber,
      UserRole.academicQa => AppColors.accentViolet,
      UserRole.principal => AppColors.accentEmerald,
      UserRole.finance => AppColors.accentAmber,
      UserRole.admin => AppColors.textSecondary,
    };
    return KSChip(label: role.label, color: color, size: ChipSize.small);
  }
}
