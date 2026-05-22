import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_back_button.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_subject_card.dart';
import '../../widgets/student/student_surface.dart';

class TermResultsDetailScreen extends ConsumerWidget {
  const TermResultsDetailScreen({super.key, required this.termId});

  final String termId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final termAsync = ref.watch(termByIdProvider(termId));
    final subjectsAsync = ref.watch(sortedSubjectsForTermProvider(termId));

    return Scaffold(
      body: termAsync.when(
        data: (term) {
          if (term == null) return const Center(child: Text('Term not found'));
          return subjectsAsync.when(
            data: (subjects) => CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: StudentHeroHeader(
                    kicker: 'TERM RESULTS',
                    title: '${term.label} ${term.academicYear}',
                    subtitle:
                        '${term.overallScore.toStringAsFixed(1)}% overall with ${subjects.length} subjects recorded.',
                    trailing: const KSBackButton(),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList.list(
                    children: [
                      StudentSurface(
                        children: [
                          Row(
                            children: [
                              KSGradeDisplay(
                                grade: term.overallGrade,
                                size: GradeDisplaySize.hero,
                              ),
                              const SizedBox(width: 18),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Overall performance',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleLarge,
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 10,
                                      runSpacing: 10,
                                      children: [
                                        KSRankBadge(
                                          rank: term.rank,
                                          total: term.totalStudents,
                                        ),
                                        KSChip.grade(term.overallGrade),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      StudentSurface(
                        color: AppColors.skyBlue50,
                        padding: const EdgeInsets.all(16),
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.info_outline_rounded,
                                color: AppColors.skyBlue700,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Support areas appear first, followed by stronger subjects, so review starts where it matters most.',
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(height: 1.45),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Subjects',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      ...subjects.map(
                        (subject) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: KSSubjectCard(
                            subject: subject,
                            onTap: () {
                              ref
                                  .read(
                                    selectedResultsSubjectIdProvider.notifier,
                                  )
                                  .state = subject
                                  .id;
                              context.push(
                                '/student/results/subject/${subject.id}',
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
            error: (error, stack) => const KSEmptyState(
              title: 'Something went wrong',
              subtitle: 'We couldn\'t load your data. Pull down to refresh.',
            ),
          );
        },
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
      ),
    );
  }
}
