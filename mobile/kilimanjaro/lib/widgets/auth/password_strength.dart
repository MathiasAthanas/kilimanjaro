import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class PasswordStrength extends StatelessWidget {
  const PasswordStrength({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final level = _level(password);
    final color = switch (level) {
      1 => AppColors.accentRose,
      2 => AppColors.accentAmber,
      3 => AppColors.skyBlue500,
      4 => AppColors.accentEmerald,
      _ => AppColors.border,
    };
    final label = switch (level) {
      1 => 'Weak',
      2 => 'Fair',
      3 => 'Good',
      4 => 'Strong',
      _ => 'Empty',
    };

    return Column(
      children: [
        Row(
          children: List.generate(4, (index) {
            return Expanded(
              child: Container(
                margin: EdgeInsets.only(right: index == 3 ? 0 : 8),
                height: 4,
                decoration: BoxDecoration(
                  color: index < level ? color : AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            label,
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }

  int _level(String password) {
    if (password.isEmpty) return 0;
    if (password.length < 8) return 1;
    final hasUpper = password.contains(RegExp(r'[A-Z]'));
    final hasNumber = password.contains(RegExp(r'\d'));
    final hasSpecial = password.contains(RegExp(r'[^A-Za-z0-9]'));
    if (password.length >= 12 && hasUpper && hasNumber && hasSpecial) return 4;
    if (hasUpper && hasNumber) return 3;
    return 2;
  }
}
