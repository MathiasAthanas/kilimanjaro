import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/utils/alert_translator.dart';
import '../../models/performance_snapshot_model.dart';

class KSAlertCard extends StatefulWidget {
  const KSAlertCard({
    super.key,
    required this.alertType,
    required this.severity,
    required this.subjectName,
    required this.studentName,
    required this.onTap,
    this.peerName,
    this.isPositive = false,
    this.showAction = true,
    this.opacity = 1,
    this.messageOverride,
  });

  final PerformanceAlertType alertType;
  final PerformanceAlertSeverity severity;
  final String subjectName;
  final String studentName;
  final String? peerName;
  final bool isPositive;
  final VoidCallback onTap;
  final bool showAction;
  final double opacity;
  final String? messageOverride;

  @override
  State<KSAlertCard> createState() => _KSAlertCardState();
}

class _KSAlertCardState extends State<KSAlertCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.96, end: 1.02), weight: 55),
      TweenSequenceItem(tween: Tween(begin: 1.02, end: 1), weight: 45),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutBack));
    _glow = Tween<double>(begin: 0.20, end: 0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    if (widget.isPositive) {
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
    final accent = widget.isPositive ? AppColors.accentEmerald : _severityColor(widget.severity);
    final background = accent.withValues(alpha: isDark ? 0.10 : 0.06);
    final message = widget.messageOverride ??
        AlertTranslator.parentMessage(
          widget.alertType,
          studentName: widget.studentName,
          subjectName: widget.subjectName,
        );

    return Opacity(
      opacity: widget.opacity,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.scale(
            scale: widget.isPositive ? _scale.value : 1,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: accent.withValues(alpha: 0.25)),
                boxShadow: [
                  ...AppShadows.shadow1,
                  if (widget.isPositive)
                    BoxShadow(
                      color: AppColors.accentEmerald.withValues(alpha: _glow.value),
                      blurRadius: 12,
                    ),
                ],
              ),
              child: InkWell(
                onTap: widget.onTap,
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 4,
                        height: widget.peerName == null ? 96 : 120,
                        decoration: BoxDecoration(
                          color: accent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    widget.subjectName.characters.first.toUpperCase(),
                                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                          color: accent,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        widget.subjectName,
                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                              fontWeight: FontWeight.w600,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: BoxDecoration(
                                              color: accent,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            widget.isPositive
                                                ? 'Great Progress!'
                                                : AlertTranslator.severityLabel(widget.severity),
                                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                                  color: accent,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              message,
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
                            ),
                            if (widget.peerName != null) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.group_add_outlined,
                                    size: 14,
                                    color: AppColors.accentIndigo,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'Study partner arranged: ${widget.peerName}',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: AppColors.accentIndigo,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (widget.showAction) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Text(
                                    widget.isPositive ? "See How They're Doing" : 'View Details',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: accent,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                  const Spacer(),
                                  Icon(
                                    Icons.chevron_right_rounded,
                                    size: 16,
                                    color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Color _severityColor(PerformanceAlertSeverity severity) {
    switch (severity) {
      case PerformanceAlertSeverity.critical:
        return AppColors.accentRose;
      case PerformanceAlertSeverity.high:
        return AppColors.accentAmber;
      case PerformanceAlertSeverity.low:
        return AppColors.skyBlue500;
    }
  }
}
