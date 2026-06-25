import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_grade_display.dart';
import 'ks_rank_badge.dart';

class ReportCardDetailWidget extends StatelessWidget {
  const ReportCardDetailWidget({
    super.key,
    required this.title,
    required this.subtitle,
    required this.classLabel,
    required this.stream,
    required this.overallScore,
    required this.overallGrade,
    required this.rank,
    required this.totalStudents,
    required this.generatedAt,
    required this.subjectRows,
    required this.teacherTitle,
    required this.teacherAuthor,
    required this.teacherMessage,
    required this.principalTitle,
    required this.principalAuthor,
    required this.principalMessage,
    this.headerNote,
    this.stageLabel,
    this.combinationCode,
    this.reportTemplateCode,
    this.divisionSummary,
    this.showInternalAlerts = false,
  });

  final String title;
  final String subtitle;
  final String classLabel;
  final String stream;
  final double overallScore;
  final String overallGrade;
  final int rank;
  final int totalStudents;
  final String generatedAt;
  final List<ReportCardSubjectRow> subjectRows;
  final String teacherTitle;
  final String teacherAuthor;
  final String teacherMessage;
  final String principalTitle;
  final String principalAuthor;
  final String principalMessage;
  final String? headerNote;
  final String? stageLabel;
  final String? combinationCode;
  final String? reportTemplateCode;
  final String? divisionSummary;
  final bool showInternalAlerts;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final paperColor =
        isDark ? AppColors.darkSurface.withValues(alpha: 0.96) : const Color(0xFFFDF8ED);
    final paperInner =
        isDark ? AppColors.darkCard.withValues(alpha: 0.72) : AppColors.white.withValues(alpha: 0.72);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: paperColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.accentAmber.withValues(alpha: 0.18)),
          boxShadow: const [
            BoxShadow(color: Color(0x12000000), blurRadius: 20, offset: Offset(0, 8)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.description_outlined, color: AppColors.skyBlue700),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 4),
                      Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                      if (headerNote != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          headerNote!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.accentIndigo,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
                KSGradeDisplay(
                  grade: overallGrade,
                  size: GradeDisplaySize.medium,
                  showLabel: false,
                ),
              ],
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _InfoChip(label: 'Class', value: '$classLabel $stream', backgroundColor: paperInner),
                if (stageLabel != null) _InfoChip(label: 'Stage', value: stageLabel!, backgroundColor: paperInner),
                if (combinationCode != null) _InfoChip(label: 'Combination', value: combinationCode!, backgroundColor: paperInner),
                if (reportTemplateCode != null) _InfoChip(label: 'Template', value: reportTemplateCode!, backgroundColor: paperInner),
                _InfoChip(label: 'Score', value: '${overallScore.toStringAsFixed(1)}%', backgroundColor: paperInner),
                _InfoChip(label: 'Rank', value: '$rank/$totalStudents', backgroundColor: paperInner),
                _InfoChip(label: 'Generated', value: generatedAt, backgroundColor: paperInner),
              ],
            ),
            const SizedBox(height: 20),
            KSRankBadge(rank: rank, total: totalStudents),
            if (divisionSummary != null) ...[
              const SizedBox(height: 12),
              _StageSummaryCard(summary: divisionSummary!, backgroundColor: paperInner),
            ],
            const SizedBox(height: 20),
            Text('Subject Results', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Table(
              border: TableBorder.all(color: const Color(0xFFE8DCC0)),
              columnWidths: const {
                0: FlexColumnWidth(2.2),
                1: FlexColumnWidth(1.1),
                2: FlexColumnWidth(0.9),
              },
              children: [
                const TableRow(
                  decoration: BoxDecoration(color: AppColors.skyBlue700),
                  children: [
                    Padding(
                      padding: EdgeInsets.all(10),
                      child: Text('Subject', style: TextStyle(color: AppColors.white)),
                    ),
                    Padding(
                      padding: EdgeInsets.all(10),
                      child: Text('Score', style: TextStyle(color: AppColors.white)),
                    ),
                    Padding(
                      padding: EdgeInsets.all(10),
                      child: Text('Grade', style: TextStyle(color: AppColors.white)),
                    ),
                  ],
                ),
                ...subjectRows.map(
                  (subject) => TableRow(
                    decoration: BoxDecoration(
                      color: subject.isPassing
                          ? Colors.transparent
                          : AppColors.accentRose.withValues(alpha: 0.06),
                    ),
                    children: [
                      Padding(padding: const EdgeInsets.all(10), child: Text(subject.name)),
                      Padding(
                        padding: const EdgeInsets.all(10),
                        child: Text('${subject.score.toStringAsFixed(0)}%'),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(10),
                        child: Text(subject.grade, style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (showInternalAlerts) ...[
              const SizedBox(height: 20),
              Text('Performance Note', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                'Internal performance note enabled for this report card view.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
            const SizedBox(height: 20),
            _RemarkCard(
              title: teacherTitle,
              author: teacherAuthor,
              message: teacherMessage,
              backgroundColor: paperInner,
            ),
            const SizedBox(height: 12),
            _RemarkCard(
              title: principalTitle,
              author: principalAuthor,
              message: principalMessage,
              backgroundColor: paperInner,
            ),
          ],
        ),
      ),
    );
  }
}

class ReportCardSubjectRow {
  const ReportCardSubjectRow({
    required this.name,
    required this.score,
    required this.grade,
    required this.isPassing,
  });

  final String name;
  final double score;
  final String grade;
  final bool isPassing;
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.label,
    required this.value,
    required this.backgroundColor,
  });

  final String label;
  final String value;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _StageSummaryCard extends StatelessWidget {
  const _StageSummaryCard({
    required this.summary,
    required this.backgroundColor,
  });

  final String summary;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accentIndigo.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.auto_graph_rounded, color: AppColors.accentIndigo),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Stage summary', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(summary, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RemarkCard extends StatelessWidget {
  const _RemarkCard({
    required this.title,
    required this.author,
    required this.message,
    required this.backgroundColor,
  });

  final String title;
  final String author;
  final String message;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(author, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 10),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
