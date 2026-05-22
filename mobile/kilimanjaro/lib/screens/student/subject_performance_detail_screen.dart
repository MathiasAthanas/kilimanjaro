import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/charts/ks_bar_chart.dart';
import '../../widgets/charts/ks_line_chart.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/student/student_surface.dart';

class SubjectPerformanceDetailScreen extends ConsumerWidget {
  const SubjectPerformanceDetailScreen({
    super.key,
    required this.subjectId,
    this.title = 'Subject Performance',
  });

  final String subjectId;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subject = ref.watch(subjectByIdProvider(subjectId));
    final trendAsync = ref.watch(performanceTrendProvider(subjectId));
    final pairingAsync = ref.watch(peerPairingProvider(subjectId));
    final alertAsync = ref.watch(studentAlertsProvider);

    if (subject == null) {
      return const Scaffold(body: Center(child: Text('Subject not found')));
    }

    final color = subject.isPassing
        ? AppColors.skyBlue600
        : AppColors.accentRose;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: StudentHeroHeader(
              kicker: title.toUpperCase(),
              title: subject.name,
              subtitle:
                  '${subject.score.toStringAsFixed(0)}% current score / Rank ${subject.rank}/${subject.totalStudents}.',
              trailing: IconButton.filledTonal(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList.list(
              children: [
                StudentSurface(
                  color: color.withValues(alpha: 0.10),
                  children: [
                    Row(
                      children: [
                        KSGradeDisplay(
                          grade: subject.grade,
                          size: GradeDisplaySize.large,
                        ),
                        const SizedBox(width: 18),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                subject.name,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${subject.score.toStringAsFixed(0)}%',
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(
                                      color: color,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              KSRankBadge(
                                rank: subject.rank,
                                total: subject.totalStudents,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                trendAsync.when(
                  data: (trend) => StudentSurface(
                    children: [
                      Text(
                        'Three-Term Trend',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Track how this subject has changed across recent terms.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 16),
                      if (trend != null)
                        KSLineChart(
                          dataPoints: [
                            for (var i = 0; i < trend.points.length; i++)
                              ChartPoint(
                                x: i.toDouble(),
                                y: trend.points[i].value,
                                grade: trend.points[i].grade,
                              ),
                          ],
                          labels: trend.points
                              .map((item) => item.label)
                              .toList(),
                          lineColor: color,
                          referenceLines: const [
                            ReferenceLine(
                              value: 70,
                              label: 'Target',
                              color: AppColors.accentAmber,
                            ),
                            ReferenceLine(
                              value: 40,
                              label: 'Risk',
                              color: AppColors.accentRose,
                            ),
                          ],
                        ),
                    ],
                  ),
                  loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
                  error: (error, stack) => const Text('Unable to load', style: TextStyle(color: AppColors.textMuted)),
                ),
                const SizedBox(height: 18),
                StudentSurface(
                  children: [
                    Text(
                      'Assessment Breakdown',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'CAT 1, CAT 2, midterm, and final assessment performance.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    KSBarChart(
                      bars: subject.assessments
                          .map(
                            (item) => BarData(
                              label: item.label,
                              value: item.score,
                              maxValue: 100,
                              color: color,
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                alertAsync.when(
                  data: (alerts) {
                    final match = alerts
                        .where((item) => item.subjectId == subjectId)
                        .firstOrNull;
                    if (match == null) return const SizedBox.shrink();
                    return StudentSurface(
                      children: [
                        KSChip(
                          label: match.isResolved
                              ? 'RECOVERED'
                              : 'ACTIVE ALERT',
                          color: match.isResolved
                              ? AppColors.accentEmerald
                              : AppColors.accentAmber,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          match.title,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          match.message,
                          style: Theme.of(
                            context,
                          ).textTheme.bodyMedium?.copyWith(height: 1.45),
                        ),
                      ],
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (error, stack) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 18),
                pairingAsync.when(
                  data: (pairing) {
                    if (pairing == null) return const SizedBox.shrink();
                    return StudentSurface(
                      children: [
                        Text(
                          'Peer Pairing',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'You are currently paired with a high-performing peer for guided support.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '${pairing.peerName} / Rank ${pairing.peerRank} / ${pairing.peerScore.toStringAsFixed(0)}%',
                        ),
                        const SizedBox(height: 8),
                        KSChip(
                          label: pairing.status,
                          color: AppColors.accentEmerald,
                        ),
                      ],
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (error, stack) => const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
