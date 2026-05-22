import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class BarData {
  const BarData({
    required this.label,
    required this.value,
    required this.maxValue,
    required this.color,
  });

  final String label;
  final double value;
  final double maxValue;
  final Color color;
}

class KSBarChart extends StatefulWidget {
  const KSBarChart({
    super.key,
    required this.bars,
    this.height = 180,
    this.showValues = true,
    this.animate = true,
  });

  final List<BarData> bars;
  final double height;
  final bool showValues;
  final bool animate;

  @override
  State<KSBarChart> createState() => _KSBarChartState();
}

class _KSBarChartState extends State<KSBarChart>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    if (widget.animate) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _controller.forward();
      });
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: widget.height,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: widget.bars.fold<double>(
                100,
                (value, item) => item.maxValue > value ? item.maxValue : value,
              ),
              minY: 0,
              barTouchData: BarTouchData(enabled: false),
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                leftTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= widget.bars.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          widget.bars[index].label,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark
                                ? AppColors.darkMuted
                                : AppColors.textMuted,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              barGroups: [
                for (var i = 0; i < widget.bars.length; i++)
                  BarChartGroupData(
                    x: i,
                    barsSpace: 8,
                    barRods: [
                      BarChartRodData(
                        toY: widget.bars[i].value * _controller.value,
                        width: 22,
                        borderRadius:
                            const BorderRadius.vertical(top: Radius.circular(8)),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: widget.bars[i].maxValue,
                          color: widget.bars[i].color
                              .withValues(alpha: isDark ? 0.12 : 0.08),
                        ),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            widget.bars[i].color,
                            widget.bars[i].color.withValues(alpha: 0.6),
                          ],
                        ),
                      ),
                    ],
                    showingTooltipIndicators: const [],
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
