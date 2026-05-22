import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class KSTrendArrow extends StatelessWidget {
  const KSTrendArrow({
    super.key,
    required this.delta,
  });

  final double delta;

  @override
  Widget build(BuildContext context) {
    final positive = delta >= 0;
    final color = positive ? AppColors.accentEmerald : AppColors.accentRose;
    final icon =
        positive ? Icons.trending_up_rounded : Icons.trending_down_rounded;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 4),
        Text(
          '${positive ? '+' : ''}${delta.toStringAsFixed(1)}%',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
