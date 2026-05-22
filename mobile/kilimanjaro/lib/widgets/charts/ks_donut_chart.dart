import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class DonutSlice {
  const DonutSlice({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value;
  final Color color;
}

class KSDonutChart extends StatefulWidget {
  const KSDonutChart({
    super.key,
    required this.slices,
    this.size = 170,
    this.centerLabel,
  });

  final List<DonutSlice> slices;
  final double size;
  final String? centerLabel;

  @override
  State<KSDonutChart> createState() => _KSDonutChartState();
}

class _KSDonutChartState extends State<KSDonutChart>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.slices.fold<double>(0, (sum, item) => sum + item.value);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: widget.size,
      width: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Stack(
            alignment: Alignment.center,
            children: [
              PieChart(
                PieChartData(
                  centerSpaceRadius: widget.size * 0.28,
                  sectionsSpace: 2,
                  borderData: FlBorderData(show: false),
                  sections: widget.slices.map((slice) {
                    return PieChartSectionData(
                      value: slice.value * _controller.value,
                      color: slice.color,
                      radius: widget.size * 0.16,
                      title: '${((slice.value / total) * 100).round()}%',
                      titleStyle: const TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    );
                  }).toList(),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.centerLabel ?? total.toStringAsFixed(0),
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: isDark ? AppColors.darkText : AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    'Summary',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
