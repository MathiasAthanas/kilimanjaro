import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/report_card_detail_widget.dart';
import '../../widgets/common/report_card_download_button.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class ReportCardDetailScreen extends ConsumerWidget {
  const ReportCardDetailScreen({super.key, required this.termId});

  final String termId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(reportCardByIdProvider(termId));
    final termAsync = ref.watch(termByIdProvider(termId));
    final authState = ref.watch(authControllerProvider);

    final studentName = authState is AuthAuthenticated
        ? authState.user.name
        : 'Student';
    final registrationNumber = authState is AuthAuthenticated
        ? (authState.user.registrationNumber ?? '')
        : '';

    return Scaffold(
      body: cardAsync.when(
        data: (card) {
          if (card == null) {
            return const Center(child: Text('Report card not found'));
          }
          return termAsync.when(
            data: (term) {
              if (term == null) {
                return const Center(child: Text('Report card not found'));
              }
              return CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: StudentHeroHeader(
                      kicker: 'REPORT CARD',
                      title: card.title,
                      subtitle:
                          '${card.overallScore.toStringAsFixed(1)}% overall / Rank ${card.rank}/${card.totalStudents}.',
                      trailing: IconButton.filledTonal(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: ReportCardDetailWidget(
                      title: card.title,
                      subtitle: '${card.stageLabel} / Kilimanjaro Schools',
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
                      generatedAt: formatShortDate(DateTime(2026, 3, 21)),
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
                      showInternalAlerts: false,
                    ),
                  ),
                  // Space for FAB
                  const SliverToBoxAdapter(child: SizedBox(height: 96)),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(16),
              child: KSShimmerList(itemCount: 5),
            ),
            error: (_, __) => const KSEmptyState(
              title: 'Something went wrong',
              subtitle: "We couldn't load your data. Pull down to refresh.",
            ),
          );
        },
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 5),
        ),
        error: (_, __) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: "We couldn't load your data. Pull down to refresh.",
        ),
      ),
      // ── Download FAB ──
      floatingActionButton: cardAsync.maybeWhen(
        data: (card) => termAsync.maybeWhen(
          data: (term) {
            if (card == null || term == null) return null;
            return ReportCardDownloadButton(
              studentName: studentName,
              registrationNumber: registrationNumber,
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
