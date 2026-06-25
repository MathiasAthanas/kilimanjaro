import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/parent_provider.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/report_card_detail_widget.dart';
import '../../widgets/common/report_card_download_button.dart';
import 'parent_formatters.dart';

class ParentReportCardViewScreen extends ConsumerWidget {
  const ParentReportCardViewScreen({super.key, required this.termId});

  final String termId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(parentReportCardByIdProvider(termId));
    final termAsync = ref.watch(parentTermByIdProvider(termId));
    final child = ref.watch(activeParentChildProvider).value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'Report Card',
        subtitle: child != null ? '${child.name} · ${child.classLabel}' : null,
        variant: KSAppBarVariant.hero,
      ),
      body: cardAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 6),
        ),
        error: (_, __) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: "We couldn't load your data. Pull down to refresh.",
        ),
        data: (card) => termAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: KSShimmerList(itemCount: 6),
          ),
          error: (_, __) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: "We couldn't load your data. Pull down to refresh.",
          ),
          data: (term) {
            if (card == null || term == null) {
              return const KSEmptyState(title: 'Report card not found');
            }
            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: ReportCardDetailWidget(
                    title: card.title,
                    subtitle:
                        '${child?.name ?? 'Student'} / Kilimanjaro Schools',
                    classLabel: card.classLabel,
                    stream: card.stream,
                    stageLabel: card.stageLabel,
                    combinationCode: card.combinationCode,
                    reportTemplateCode: card.reportTemplateCode,
                    divisionSummary: card.divisionSummary,
                    overallScore: card.overallScore,
                    overallGrade: card.overallGrade,
                    rank: card.rank,
                    totalStudents: card.totalStudents,
                    generatedAt: formatParentShortDate(DateTime(2026, 3, 21)),
                    subjectRows: term.subjects
                        .map(
                          (subject) => ReportCardSubjectRow(
                            name: subject.name,
                            score: subject.score,
                            grade: subject.grade,
                            isPassing: subject.isPassing,
                          ),
                        )
                        .toList(),
                    teacherTitle: card.teacherRemark.role,
                    teacherAuthor: card.teacherRemark.author,
                    teacherMessage: card.teacherRemark.message,
                    principalTitle: card.principalRemark.role,
                    principalAuthor: card.principalRemark.author,
                    principalMessage: card.principalRemark.message,
                    headerNote: "Parent's copy",
                    showInternalAlerts: false,
                  ),
                ),
                // Space for FAB
                const SliverToBoxAdapter(child: SizedBox(height: 96)),
              ],
            );
          },
        ),
      ),
      // ── Download FAB ──
      floatingActionButton: cardAsync.maybeWhen(
        data: (card) => termAsync.maybeWhen(
          data: (term) {
            if (card == null || term == null || child == null) return null;
            return ReportCardDownloadButton(
              studentName: child.name,
              registrationNumber: child.registrationNumber,
              termTitle: card.title,
              classLabel: card.classLabel,
              stream: card.stream,
              stageLabel: card.stageLabel,
              combinationCode: card.combinationCode,
              academicYear: term.academicYear,
              overallScore: card.overallScore,
              overallGrade: card.overallGrade,
              rank: card.rank,
              totalStudents: card.totalStudents,
              divisionSummary: card.divisionSummary,
              subjects: term.subjects,
              teacherRemark: card.teacherRemark,
              principalRemark: card.principalRemark,
            );
          },
          orElse: () => null,
        ),
        orElse: () => null,
      ),
    );
  }
}
