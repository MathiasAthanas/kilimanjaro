import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../models/hod_models.dart';

class HodSurface extends ConsumerWidget {
  const HodSurface({super.key, required this.children, this.header});
  final Widget? header;
  final List<Widget> children;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottom = ref.watch(shellControllerProvider).navBarHeight + 24;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [AppColors.darkBg, const Color(0xFF111827)]
                    : [const Color(0xFFDDF4FF), AppColors.offWhite],
              ),
            ),
          ),
        ),
        Positioned(
          top: -80,
          right: -70,
          child: Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.skyBlue300.withValues(alpha: isDark ? 0.08 : 0.23),
            ),
          ),
        ),
        Positioned(
          top: 110,
          left: -92,
          child: Container(
            width: 180,
            height: 180,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accentAmber.withValues(alpha: isDark ? 0.05 : 0.10),
            ),
          ),
        ),
        ListView(
          padding: EdgeInsets.fromLTRB(16, 14, 16, bottom),
          children: [
            if (header != null) ...[
              header!
                  .animate()
                  .fadeIn(duration: 360.ms)
                  .slideY(begin: 0.04, end: 0),
              const SizedBox(height: 16),
            ],
            ...children
                .animate(interval: 38.ms)
                .fadeIn(duration: 300.ms)
                .slideY(begin: 0.025, end: 0, curve: Curves.easeOutCubic),
          ],
        ),
      ],
    );
  }
}

class HodGlassBand extends StatelessWidget {
  const HodGlassBand({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurface.withValues(alpha: 0.92)
            : AppColors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder
              : AppColors.white.withValues(alpha: 0.82),
        ),
        boxShadow: isDark ? null : AppShadows.shadow1,
      ),
      child: Column(children: children),
    );
  }
}


class HodInsightCard extends StatelessWidget {
  const HodInsightCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.onTap,
  });
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(17),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HodCard extends StatelessWidget {
  const HodCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.only(bottom: 16),
  });
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final content = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder
              : AppColors.border.withValues(alpha: 0.75),
        ),
        boxShadow: isDark ? null : AppShadows.shadow1,
      ),
      child: child,
    );
    if (onTap == null) return content;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: content,
    );
  }
}

class HodSectionTitle extends StatelessWidget {
  const HodSectionTitle({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 4, 2, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
          if (action != null)
            TextButton(onPressed: onAction, child: Text(action!)),
        ],
      ),
    );
  }
}

class HodPill extends StatelessWidget {
  const HodPill({super.key, required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w900,
          fontSize: 12,
        ),
      ),
    );
  }
}

class HodApprovalCard extends StatelessWidget {
  const HodApprovalCard({
    super.key,
    required this.item,
    this.onTap,
    this.margin = const EdgeInsets.only(bottom: 16),
  });
  final HodApproval item;
  final VoidCallback? onTap;
  final EdgeInsets margin;
  @override
  Widget build(BuildContext context) {
    final color = item.averagePercent < 50
        ? AppColors.accentRose
        : item.submittedAgo.contains('3 days')
        ? AppColors.accentRose
        : AppColors.accentAmber;
    return HodCard(
      onTap: onTap,
      margin: margin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${item.subject} ${item.classLabel} ${item.assessmentType}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              HodPill(label: item.submittedAgo, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text('${item.teacherName} - ${item.studentCount} students marked'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SmallStat(
                  label: 'Avg',
                  value:
                      '${item.classAverage.toStringAsFixed(1)}/${item.maxScore.toStringAsFixed(0)}',
                  color: color,
                ),
              ),
              Expanded(
                child: _SmallStat(
                  label: 'High',
                  value: item.highest.toStringAsFixed(0),
                  color: AppColors.accentEmerald,
                ),
              ),
              Expanded(
                child: _SmallStat(
                  label: 'Low',
                  value: item.lowest.toStringAsFixed(0),
                  color: AppColors.accentRose,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class GradeDistributionBar extends StatelessWidget {
  const GradeDistributionBar({super.key, required this.distribution});
  final Map<String, int> distribution;
  @override
  Widget build(BuildContext context) {
    final total = distribution.values.fold<int>(0, (sum, value) => sum + value);
    final colors = {
      'A': AppColors.accentEmerald,
      'B': AppColors.skyBlue600,
      'C': AppColors.accentAmber,
      'D': AppColors.accentIndigo,
      'F': AppColors.accentRose,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Row(
            children: distribution.entries.toList().asMap().entries.map((
              indexed,
            ) {
              final entry = indexed.value;
              return Expanded(
                flex: entry.value == 0 ? 1 : entry.value,
                child:
                    Container(
                          height: 20,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: colors[entry.key] ?? AppColors.textMuted,
                            border: Border(
                              right: BorderSide(
                                color: AppColors.white.withValues(alpha: 0.65),
                              ),
                            ),
                          ),
                          child: entry.value > 3
                              ? Text(
                                  '${entry.value}',
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                  ),
                                )
                              : null,
                        )
                        .animate(delay: (indexed.key * 45).ms)
                        .scaleX(
                          begin: 0,
                          end: 1,
                          alignment: Alignment.centerLeft,
                          duration: 260.ms,
                          curve: Curves.easeOutCubic,
                        ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 8,
          children: distribution.entries.map((e) {
            final percent = total == 0 ? 0 : (e.value / total * 100).round();
            final color = colors[e.key] ?? AppColors.textMuted;
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '${e.key} ${e.value} ($percent%)',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _SmallStat extends StatelessWidget {
  const _SmallStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: color,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
