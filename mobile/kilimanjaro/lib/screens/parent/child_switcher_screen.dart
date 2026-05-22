import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ChildSwitcherScreen extends ConsumerWidget {
  const ChildSwitcherScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(parentChildrenProvider);
    final activeChildId = ref.watch(activeParentChildIdProvider);

    return Scaffold(
      appBar: const KSAppBar(
        title: 'My Children',
        subtitle: 'Switch active child to update all parent screens',
        variant: KSAppBarVariant.hero,
      ),
      body: childrenAsync.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (children) {
          if (children.isEmpty) {
            return const KSEmptyState(
              title: 'No linked children',
              subtitle: 'Parent account has no active child profiles.',
            );
          }
          return ParentSurface(
            children: [
              _IntroCard(count: children.length),
              ...children
                .map(
                  (child) => _ChildCard(
                    child: child,
                    active: child.id == activeChildId,
                    onTap: () {
                      ref.read(activeParentChildIdProvider.notifier).state =
                          child.id;
                      context.go('/shell/parent/home');
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _IntroCard extends StatelessWidget {
  const _IntroCard({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
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
              Icons.family_restroom_rounded,
              color: AppColors.skyBlue600,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              'Select a child to view their information. This active child powers all parent screens.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.45),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '$count',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: AppColors.skyBlue600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChildCard extends StatefulWidget {
  const _ChildCard({
    required this.child,
    required this.active,
    required this.onTap,
  });

  final ChildSummary child;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_ChildCard> createState() => _ChildCardState();
}

class _ChildCardState extends State<_ChildCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = widget.active ? AppColors.skyBlue600 : AppColors.border;
    return GestureDetector(
      onTap: widget.active ? null : widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        duration: const Duration(milliseconds: 160),
        scale: _pressed ? 0.975 : 1,
        child: ParentCard(
          padding: EdgeInsets.zero,
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        KSAvatar(name: widget.child.name, size: 58),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.child.name,
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${widget.child.classLabel} - ${widget.child.registrationNumber}',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  _MiniStat(
                                    text:
                                        'Avg ${widget.child.overallScore.toStringAsFixed(1)}%',
                                    color: AppColors.skyBlue600,
                                  ),
                                  _MiniStat(
                                    text:
                                        'Attendance ${widget.child.attendanceRate.toStringAsFixed(1)}%',
                                    color: AppColors.accentEmerald,
                                  ),
                                  _MiniStat(
                                    text: widget.child.isFullyPaid
                                        ? 'Fees paid'
                                        : '${formatParentShortTzs(widget.child.outstandingBalance)} due',
                                    color: widget.child.isFullyPaid
                                        ? AppColors.accentEmerald
                                        : AppColors.accentAmber,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (!widget.active) ...[
                      const SizedBox(height: 16),
                      Divider(
                        height: 1,
                        color: AppColors.border.withValues(alpha: 0.7),
                      ),
                      const SizedBox(height: 14),
                      KSButton(
                        label: 'Switch to ${widget.child.firstName}',
                        secondary: true,
                        onPressed: widget.onTap,
                      ),
                    ],
                  ],
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(
                        color: color,
                        width: widget.active ? 2 : 1,
                      ),
                    ),
                  ),
                ),
              ),
              if (widget.active)
                Positioned(
                  right: 0,
                  top: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.skyBlue600,
                      borderRadius: BorderRadius.only(
                        topRight: Radius.circular(22),
                        bottomLeft: Radius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Active',
                      style: TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ).animate().fadeIn().slideY(begin: 0.03, end: 0),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
