import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/subject_result_model.dart';
import 'ks_assessment_row.dart';
import 'ks_chip.dart';
import 'ks_rank_badge.dart';

class KSSubjectCard extends ConsumerWidget {
  const KSSubjectCard({
    super.key,
    required this.subject,
    this.onTap,
    this.compact = false,
  });

  final SubjectResultModel subject;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(selectedResultsSubjectIdProvider);
    final expanded = selectedId == subject.id && !compact;
    final accent = subject.isPassing ? AppColors.skyBlue500 : AppColors.accentRose;

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withValues(alpha: 0.12)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final stacked = constraints.maxWidth < 330;
              final scoreBlock = Column(
                crossAxisAlignment:
                    stacked ? CrossAxisAlignment.start : CrossAxisAlignment.end,
                children: [
                  Text(
                    '${subject.score.toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 4),
                  KSRankBadge(rank: subject.rank, total: subject.totalStudents),
                ],
              );

              return Column(
                children: [
                  if (stacked)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(subject.name, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        KSChip.grade(subject.grade),
                        const SizedBox(height: 12),
                        scoreBlock,
                      ],
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(subject.name, style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 6),
                              KSChip.grade(subject.grade),
                            ],
                          ),
                        ),
                        scoreBlock,
                      ],
                    ),
                  if (expanded && subject.assessments.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Divider(height: 1),
                    const SizedBox(height: 8),
                    ...subject.assessments.map((item) => KSAssessmentRow(assessment: item)),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
