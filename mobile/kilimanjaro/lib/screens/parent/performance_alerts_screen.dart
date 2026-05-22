import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../models/performance_snapshot_model.dart';
import '../../widgets/common/ks_alert_card.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';

class PerformanceAlertsScreen extends ConsumerWidget {
  const PerformanceAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeChildId = ref.watch(activeParentChildIdProvider);
    final child = ref.watch(activeParentChildProvider).value;
    final alertsAsync = ref.watch(activeParentAlertsProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: child != null
            ? "${child.firstName}'s Academic Notices"
            : 'Academic Notices',
        subtitle: child != null
            ? '${child.classLabel} · school-generated performance alerts'
            : null,
        variant: KSAppBarVariant.hero,
      ),
      body: Column(
        children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeChildId,
              onSwitch: (id) =>
                  ref.read(activeParentChildIdProvider.notifier).state = id,
            ),
          Expanded(
            child: alertsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KSShimmerList(itemCount: 5),
              ),
              error: (error, stack) => const KSEmptyState(
                title: 'Something went wrong',
                subtitle: 'We couldn\'t load your data. Pull down to refresh.',
              ),
              data: (alerts) {
                if (child == null) {
                  return const KSEmptyState(title: 'No child selected');
                }
                if (alerts.isEmpty) {
                  return KSEmptyState(
                    title: 'All Clear',
                    subtitle:
                        "${child.firstName}'s academic performance is on track.",
                  );
                }

                final positive = alerts
                    .where(
                      (item) =>
                          item.type ==
                          PerformanceAlertType.consistentExcellence,
                    )
                    .toList();
                final active = alerts
                    .where(
                      (item) =>
                          !item.isResolved &&
                          item.type !=
                              PerformanceAlertType.consistentExcellence,
                    )
                    .toList();
                final resolved = alerts
                    .where((item) => item.isResolved)
                    .toList();

                return ParentSurface(
                  children: [
                    ParentCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.info_outline_rounded,
                            color: AppColors.skyBlue600,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              "These notices translate internal academic tracking into parent-friendly guidance.",
                              style: Theme.of(
                                context,
                              ).textTheme.bodyMedium?.copyWith(height: 1.45),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (positive.isNotEmpty) ...[
                      const ParentSectionTitle(title: 'Great Progress'),
                      ...positive.map(
                        (item) => KSAlertCard(
                          alertType: item.type,
                          severity: item.severity,
                          subjectName: item.subjectName,
                          studentName: child.firstName,
                          isPositive: true,
                          onTap: () =>
                              context.push('/parent/performance/trends'),
                          messageOverride:
                              '${child.firstName} is consistently excelling in ${item.subjectName}. Keep encouraging this progress.',
                        ),
                      ),
                    ],
                    if (active.isNotEmpty) ...[
                      const ParentSectionTitle(title: 'Needs Attention'),
                      ...active.map(
                        (item) => KSAlertCard(
                          alertType: item.type,
                          severity: item.severity,
                          subjectName: item.subjectName,
                          studentName: child.firstName,
                          peerName: item.subjectName == 'Biology'
                              ? 'Brian Mwangi'
                              : null,
                          onTap: () =>
                              context.push('/parent/performance/trends'),
                          messageOverride:
                              '${child.firstName} may need extra help with ${item.subjectName} this term. The school has already started support.',
                        ),
                      ),
                    ],
                    if (resolved.isNotEmpty) ...[
                      const ParentSectionTitle(title: 'Previous Notices'),
                      ...resolved.map(
                        (item) => KSAlertCard(
                          alertType: item.type,
                          severity: PerformanceAlertSeverity.low,
                          subjectName: item.subjectName,
                          studentName: child.firstName,
                          onTap: () {},
                          opacity: 0.65,
                          showAction: false,
                          messageOverride:
                              '${item.subjectName} score has recovered.',
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
