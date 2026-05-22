import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class ChartPoint {
  const ChartPoint({
    required this.x,
    required this.y,
    this.grade,
  });

  final double x;
  final double y;
  final String? grade;
}

class ReferenceLine {
  const ReferenceLine({
    required this.value,
    required this.label,
    required this.color,
  });

  final double value;
  final String label;
  final Color color;
}

class KSLineChart extends StatefulWidget {
  const KSLineChart({
    super.key,
    required this.dataPoints,
    required this.labels,
    this.lineColor = AppColors.skyBlue500,
    this.showDots = true,
    this.showGrid = true,
    this.showArea = true,
    this.minY = 0,
    this.maxY = 100,
    this.height = 220,
    this.referenceLines = const [],
    this.animate = true,
  });

  final List<ChartPoint> dataPoints;
  final List<String> labels;
  final Color lineColor;
  final bool showDots;
  final bool showGrid;
  final bool showArea;
  final double minY;
  final double maxY;
  final double height;
  final List<ReferenceLine> referenceLines;
  final bool animate;

  @override
  State<KSLineChart> createState() => _KSLineChartState();
}

class _KSLineChartState extends State<KSLineChart>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _progress = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
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
        animation: _progress,
        builder: (context, child) {
          final spots = widget.dataPoints
              .map(
                (item) => FlSpot(
                  item.x,
                  widget.minY + ((item.y - widget.minY) * _progress.value),
                ),
              )
              .toList();

          return LineChart(
            LineChartData(
              minX: 0,
              maxX: (widget.labels.length - 1).toDouble(),
              minY: widget.minY,
              maxY: widget.maxY,
              lineTouchData: LineTouchData(
                enabled: true,
                touchTooltipData: LineTouchTooltipData(
                  tooltipRoundedRadius: 12,
                  getTooltipColor: (_) =>
                      isDark ? AppColors.darkCard : AppColors.white,
                  fitInsideHorizontally: true,
                  fitInsideVertically: true,
                  getTooltipItems: (touchedSpots) {
                    return touchedSpots.map((spot) {
                      final index = spot.x.toInt();
                      final point = widget.dataPoints[index];
                      return LineTooltipItem(
                        '${widget.labels[index]}\n${point.y.toStringAsFixed(1)}% ${point.grade ?? ''}',
                        TextStyle(
                          color: isDark
                              ? AppColors.darkText
                              : AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          height: 1.3,
                        ),
                      );
                    }).toList();
                  },
                ),
              ),
              extraLinesData: ExtraLinesData(
                horizontalLines: widget.referenceLines
                    .map(
                      (line) => HorizontalLine(
                        y: line.value,
                        color: line.color.withValues(alpha: 0.6),
                        dashArray: const [4, 4],
                        strokeWidth: 1.2,
                        label: HorizontalLineLabel(
                          show: true,
                          alignment: Alignment.topRight,
                          style: TextStyle(
                            color: line.color,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                          labelResolver: (_) => line.label,
                        ),
                      ),
                    )
                    .toList(),
              ),
              gridData: FlGridData(
                show: widget.showGrid,
                drawVerticalLine: false,
                horizontalInterval: 25,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: isDark
                      ? AppColors.darkBorder.withValues(alpha: 0.4)
                      : AppColors.border.withValues(alpha: 0.5),
                  dashArray: const [4, 4],
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                leftTitles:
                    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 32,
                    interval: 25,
                    getTitlesWidget: (value, meta) => Text(
                      value.toInt().toString(),
                      style: TextStyle(
                        fontSize: 10,
                        color: isDark
                            ? AppColors.darkMuted
                            : AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 30,
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= widget.labels.length) {
                        return const SizedBox.shrink();
                      }
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          widget.labels[index],
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
              lineBarsData: [
                LineChartBarData(
                  spots: spots,
                  isCurved: true,
                  curveSmoothness: 0.35,
                  color: widget.lineColor,
                  barWidth: 2.5,
                  isStrokeCapRound: true,
                  dotData: FlDotData(
                    show: widget.showDots,
                    getDotPainter: (spot, percent, bar, index) =>
                        FlDotCirclePainter(
                      radius: 4.5 + (2 * _progress.value),
                      color: widget.lineColor,
                      strokeWidth: 2,
                      strokeColor: AppColors.white,
                    ),
                  ),
                  belowBarData: BarAreaData(
                    show: widget.showArea,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        widget.lineColor
                            .withValues(alpha: isDark ? 0.12 : 0.20),
                        widget.lineColor.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
