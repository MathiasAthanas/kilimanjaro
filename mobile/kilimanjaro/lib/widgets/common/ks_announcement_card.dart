import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/announcement_model.dart';
import 'ks_chip.dart';

class KSAnnouncementCard extends StatefulWidget {
  const KSAnnouncementCard({
    super.key,
    required this.announcement,
    this.onTap,
  });

  final AnnouncementModel announcement;
  final VoidCallback? onTap;

  @override
  State<KSAnnouncementCard> createState() => _KSAnnouncementCardState();
}

class _KSAnnouncementCardState extends State<KSAnnouncementCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    if (widget.announcement.priority == AnnouncementPriority.urgent) {
      _controller.repeat(reverse: true);
    } else {
      _controller.value = 0.5;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color get _priorityColor => switch (widget.announcement.priority) {
        AnnouncementPriority.urgent => AppColors.accentRose,
        AnnouncementPriority.high => AppColors.accentAmber,
        AnnouncementPriority.normal => AppColors.skyBlue500,
        AnnouncementPriority.low => AppColors.accentTeal,
      };

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final double glow =
            widget.announcement.priority == AnnouncementPriority.urgent
                ? 0.2 + (_controller.value * 0.3)
                : 0;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(18),
            boxShadow: glow == 0
                ? null
                : [
                    BoxShadow(
                      color: AppColors.accentRose.withValues(alpha: glow),
                      blurRadius: 22,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: widget.onTap,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  KSChip(
                    label: widget.announcement.priority.name.toUpperCase(),
                    color: _priorityColor,
                    size: ChipSize.medium,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    widget.announcement.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.announcement.body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${widget.announcement.authorRole} / ${widget.announcement.authorName}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
