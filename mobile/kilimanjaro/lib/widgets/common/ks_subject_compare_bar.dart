import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_chip.dart';

class KSSubjectCompareBar extends StatefulWidget {
  const KSSubjectCompareBar({
    super.key,
    required this.subjectName,
    required this.studentScore,
    required this.classAverage,
    required this.grade,
    required this.isPassing,
    this.onTap,
  });

  final String subjectName;
  final double studentScore;
  final double classAverage;
  final String grade;
  final bool isPassing;
  final VoidCallback? onTap;

  @override
  State<KSSubjectCompareBar> createState() => _KSSubjectCompareBarState();
}

class _KSSubjectCompareBarState extends State<KSSubjectCompareBar>
    with TickerProviderStateMixin {
  late final AnimationController _classController;
  late final AnimationController _studentController;

  @override
  void initState() {
    super.initState();
    _classController = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _studentController = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      _classController.forward();
      await Future<void>.delayed(const Duration(milliseconds: 150));
      if (mounted) _studentController.forward();
    });
  }

  @override
  void dispose() {
    _classController.dispose();
    _studentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trackColor = isDark ? AppColors.darkCard : AppColors.offWhite;
    final studentColor = !widget.isPassing
        ? AppColors.accentRose
        : widget.studentScore > widget.classAverage
            ? AppColors.accentEmerald
            : AppColors.accentAmber;

    return InkWell(
      onTap: widget.onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.subjectName,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                KSChip.grade(widget.grade),
                const SizedBox(width: 4),
                Text(
                  '${widget.studentScore.toStringAsFixed(0)}%',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                return SizedBox(
                  height: 8,
                  child: Stack(
                    children: [
                      Container(
                        width: constraints.maxWidth,
                        decoration: BoxDecoration(
                          color: trackColor,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      AnimatedBuilder(
                        animation: _classController,
                        builder: (context, child) => Container(
                          width: constraints.maxWidth *
                              (widget.classAverage / 100) *
                              _classController.value,
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1A3A5C) : AppColors.skyBlue200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                      AnimatedBuilder(
                        animation: _studentController,
                        builder: (context, child) => Container(
                          width: constraints.maxWidth *
                              (widget.studentScore / 100) *
                              _studentController.value,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [studentColor, studentColor.withValues(alpha: 0.72)],
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                _LegendDot(color: studentColor, label: '${widget.studentScore.toStringAsFixed(0)}% You'),
                _LegendDot(
                  color: isDark ? const Color(0xFF1A3A5C) : AppColors.skyBlue200,
                  label: '${widget.classAverage.toStringAsFixed(0)}% Class Avg',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({
    required this.color,
    required this.label,
  });

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
