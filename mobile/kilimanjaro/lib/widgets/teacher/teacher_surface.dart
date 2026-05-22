import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../models/teacher_models.dart';

class TeacherSurface extends ConsumerWidget {
  const TeacherSurface({
    super.key,
    required this.children,
    this.header,
    this.padding = const EdgeInsets.fromLTRB(16, 14, 16, 0),
  });

  final Widget? header;
  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottom = ref.watch(shellControllerProvider).navBarHeight + 24;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? const [AppColors.darkBg, Color(0xFF111827)]
              : const [Color(0xFFEAF7FF), AppColors.offWhite],
        ),
      ),
      child: ListView(
        padding: padding.copyWith(bottom: bottom),
        children: [
          if (header != null) ...[
            header!
                .animate()
                .fadeIn(duration: 260.ms)
                .slideY(begin: 0.04, end: 0),
            const SizedBox(height: 16),
          ],
          ...children
              .animate(interval: 42.ms)
              .fadeIn(duration: 230.ms)
              .slideY(begin: 0.03, end: 0),
        ],
      ),
    );
  }
}


class TeacherCard extends StatelessWidget {
  const TeacherCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.only(bottom: 16),
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final content = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder
              : AppColors.border.withValues(alpha: 0.7),
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

class TeacherSectionTitle extends StatelessWidget {
  const TeacherSectionTitle({
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

class TeacherStatusPill extends StatelessWidget {
  const TeacherStatusPill({
    super.key,
    required this.label,
    required this.color,
  });

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

class TeacherClassCard extends StatelessWidget {
  const TeacherClassCard({super.key, required this.item, this.onTap});

  final TeacherClassSubject item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TeacherCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.skyBlue500.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.menu_book_rounded,
              color: AppColors.skyBlue600,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text('${item.studentCount} students - next ${item.nextLesson}'),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: item.averageScore / 100,
                  minHeight: 7,
                  borderRadius: BorderRadius.circular(999),
                  color: AppColors.skyBlue600,
                  backgroundColor: AppColors.border,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

Color assessmentStatusColor(TeacherAssessmentStatus status) => switch (status) {
  TeacherAssessmentStatus.open => AppColors.accentEmerald,
  TeacherAssessmentStatus.submitted => AppColors.accentAmber,
  TeacherAssessmentStatus.approved => AppColors.accentIndigo,
  TeacherAssessmentStatus.locked => AppColors.textSecondary,
  TeacherAssessmentStatus.draft => AppColors.skyBlue600,
};

String assessmentStatusLabel(TeacherAssessmentStatus status) =>
    switch (status) {
      TeacherAssessmentStatus.open => 'OPEN',
      TeacherAssessmentStatus.submitted => 'SUBMITTED',
      TeacherAssessmentStatus.approved => 'APPROVED',
      TeacherAssessmentStatus.locked => 'LOCKED',
      TeacherAssessmentStatus.draft => 'DRAFT',
    };
