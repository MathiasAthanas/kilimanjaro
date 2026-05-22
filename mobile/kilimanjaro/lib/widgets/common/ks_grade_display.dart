import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

enum GradeDisplaySize { small, medium, large, hero }

class KSGradeDisplay extends StatefulWidget {
  const KSGradeDisplay({
    super.key,
    required this.grade,
    this.size = GradeDisplaySize.medium,
    this.showLabel = true,
    this.animate = true,
  });

  final String grade;
  final GradeDisplaySize size;
  final bool showLabel;
  final bool animate;

  @override
  State<KSGradeDisplay> createState() => _KSGradeDisplayState();
}

class _KSGradeDisplayState extends State<KSGradeDisplay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 720),
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

  double get _diameter => switch (widget.size) {
        GradeDisplaySize.small => 48,
        GradeDisplaySize.medium => 64,
        GradeDisplaySize.large => 80,
        GradeDisplaySize.hero => 100,
      };

  double get _fontSize => switch (widget.size) {
        GradeDisplaySize.small => 18,
        GradeDisplaySize.medium => 24,
        GradeDisplaySize.large => 32,
        GradeDisplaySize.hero => 40,
      };

  Color get _color {
    final grade = widget.grade.toUpperCase();
    if (grade.startsWith('A')) return AppColors.accentEmerald;
    if (grade.startsWith('B')) return AppColors.skyBlue500;
    if (grade.startsWith('C')) return AppColors.accentAmber;
    return AppColors.accentRose;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.showLabel)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Grade',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.darkMuted : AppColors.textMuted,
              ),
            ),
          ),
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final scale = TweenSequence<double>([
              TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.06), weight: 60),
              TweenSequenceItem(tween: Tween(begin: 1.06, end: 1), weight: 40),
            ]).transform(_controller.value);

            return Transform.scale(
              scale: scale,
              child: CustomPaint(
                painter: _GradeBorderPainter(
                  progress: _controller.value,
                  color: _color,
                ),
                child: Container(
                  width: _diameter,
                  height: _diameter,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _color.withValues(alpha: isDark ? 0.18 : 0.12),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    widget.grade,
                    style: TextStyle(
                      fontSize: _fontSize,
                      fontWeight: FontWeight.w800,
                      color: _color,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _GradeBorderPainter extends CustomPainter {
  const _GradeBorderPainter({
    required this.progress,
    required this.color,
  });

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      rect.deflate(2),
      -math.pi / 2,
      math.pi * 2 * progress,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _GradeBorderPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.color != color;
  }
}
