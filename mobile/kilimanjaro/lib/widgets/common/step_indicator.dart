import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class StepIndicator extends StatelessWidget {
  const StepIndicator({
    super.key,
    required this.steps,
    required this.activeIndex,
  });

  final List<String> steps;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(steps.length, (index) {
        final active = index == activeIndex;
        final done = index < activeIndex;
        return Expanded(
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                height: 6,
                decoration: BoxDecoration(
                  color: done || active ? AppColors.skyBlue500 : AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                steps[index],
                style: TextStyle(
                  fontSize: 11,
                  color: done || active
                      ? AppColors.skyBlue600
                      : AppColors.textMuted,
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
