import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../models/notification_model.dart';
import 'ks_chip.dart';
import 'ks_svg_icon.dart';

class KSNotificationCard extends StatelessWidget {
  const KSNotificationCard({
    super.key,
    required this.item,
    this.onTap,
    this.onLongPress,
  });

  final NotificationModel item;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accentFor(item.eventType);
    final channelColor = _channelColor(item.channel);
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark
              ? (item.isRead ? AppColors.darkSurface : AppColors.darkCard)
              : (item.isRead ? AppColors.white : AppColors.skyBlue50),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: item.isRead
                ? (isDark ? AppColors.darkBorder : AppColors.border)
                : accent.withValues(alpha: 0.28),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: KSSvgIcon(
                  _iconFor(item.eventType),
                  size: 18,
                  color: accent,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w700,
                            color: isDark ? AppColors.darkText : AppColors.textPrimary,
                          ),
                        ),
                      ),
                      if (!item.isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.skyBlue500,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      KSChip(
                        label: item.channel.name.toUpperCase(),
                        color: channelColor,
                        size: ChipSize.small,
                        leadingDot: false,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          DateFormat('MMM d, h:mm a').format(item.createdAt),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _accentFor(NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed => AppColors.accentEmerald,
        NotificationEventType.resultsPublished => AppColors.skyBlue500,
        NotificationEventType.attendanceMarked => AppColors.accentAmber,
        NotificationEventType.performanceAlertCreated => AppColors.accentViolet,
        NotificationEventType.marksRejected => AppColors.accentRose,
        NotificationEventType.feeOverdue => AppColors.accentRose,
        NotificationEventType.disciplineRecorded => AppColors.textSecondary,
        NotificationEventType.studentEnrolled => AppColors.accentTeal,
        NotificationEventType.announcement => AppColors.skyBlue600,
        NotificationEventType.marksApproved => AppColors.accentEmerald,
      };

  Color _channelColor(NotificationChannel channel) => switch (channel) {
        NotificationChannel.sms => AppColors.accentAmber,
        NotificationChannel.email => AppColors.accentIndigo,
        NotificationChannel.push => AppColors.accentTeal,
        NotificationChannel.inApp => AppColors.skyBlue500,
      };

  String _iconFor(NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed || NotificationEventType.feeOverdue => 'assets/icons/banknotes.svg',
        NotificationEventType.resultsPublished || NotificationEventType.marksApproved || NotificationEventType.marksRejected => 'assets/icons/graduation-cap.svg',
        NotificationEventType.attendanceMarked => 'assets/icons/calendar-check.svg',
        NotificationEventType.performanceAlertCreated => 'assets/icons/chart-line.svg',
        NotificationEventType.studentEnrolled => 'assets/icons/students.svg',
        NotificationEventType.disciplineRecorded => 'assets/icons/alert-circle.svg',
        NotificationEventType.announcement => 'assets/icons/megaphone.svg',
      };
}
