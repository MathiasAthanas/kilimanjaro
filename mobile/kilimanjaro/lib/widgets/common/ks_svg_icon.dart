import 'package:flutter/material.dart';

/// Renders an icon by asset path. All SVG assets are currently placeholder
/// stubs so this widget maps asset names directly to Material icons.
/// When real SVG files are supplied, swap build() back to SvgPicture.asset.
class KSSvgIcon extends StatelessWidget {
  const KSSvgIcon(
    this.asset, {
    super.key,
    this.size = 18,
    this.color,
    this.semanticLabel,
  });

  final String asset;
  final double size;
  final Color? color;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Icon(
      _iconFor(asset),
      size: size,
      color: color ?? IconTheme.of(context).color,
      semanticLabel: semanticLabel,
    );
  }

  static IconData _iconFor(String asset) {
    final name = asset.split('/').last.toLowerCase();
    return switch (name) {
      // ── Navigation ──────────────────────────────────────────────────────
      'home.svg' || 'home_filled.svg' => Icons.home_rounded,
      'grid-dots.svg' || 'grid-dots_filled.svg' => Icons.apps_rounded,
      'arrow-left.svg' => Icons.arrow_back_rounded,
      'arrow-right.svg' => Icons.arrow_forward_rounded,
      'chevron-right.svg' => Icons.chevron_right_rounded,
      'close.svg' => Icons.close_rounded,
      'filter.svg' => Icons.filter_list_rounded,
      'search.svg' => Icons.search_rounded,
      'refresh.svg' => Icons.refresh_rounded,
      // ── Charts & analytics ───────────────────────────────────────────────
      'chart-bar.svg' || 'chart-bar_filled.svg' => Icons.bar_chart_rounded,
      'chart-bar-square.svg' || 'chart-bar-square_filled.svg' =>
        Icons.dashboard_rounded,
      'chart-line.svg' ||
      'chart-line_filled.svg' ||
      'trending-up.svg' =>
        Icons.show_chart_rounded,
      'analytics.svg' || 'performance.svg' => Icons.insights_rounded,
      'reports.svg' => Icons.summarize_rounded,
      // ── Calendar / schedule ──────────────────────────────────────────────
      'calendar-check.svg' ||
      'calendar-check_filled.svg' ||
      'timetable.svg' =>
        Icons.calendar_month_rounded,
      // ── Finance ──────────────────────────────────────────────────────────
      'receipt.svg' || 'receipt_filled.svg' => Icons.receipt_long_rounded,
      'coin-stack.svg' || 'coin-stack_filled.svg' => Icons.savings_rounded,
      'banknotes.svg' || 'banknotes_filled.svg' || 'finance.svg' =>
        Icons.payments_rounded,
      'assets.svg' => Icons.inventory_2_rounded,
      // ── Education ────────────────────────────────────────────────────────
      'graduation-cap.svg' || 'graduation-cap_filled.svg' || 'school.svg' =>
        Icons.school_rounded,
      'book-open.svg' ||
      'book-open_filled.svg' ||
      'subjects.svg' ||
      'syllabus.svg' =>
        Icons.menu_book_rounded,
      'clipboard-check.svg' ||
      'clipboard-check_filled.svg' ||
      'assessment-types.svg' =>
        Icons.assignment_turned_in_rounded,
      'grading.svg' => Icons.grade_rounded,
      'classes.svg' => Icons.class_rounded,
      'students.svg' || 'users.svg' => Icons.people_rounded,
      'report-card.svg' => Icons.assignment_rounded,
      'document-text.svg' ||
      'document-text_filled.svg' ||
      'templates.svg' =>
        Icons.article_rounded,
      // ── People ───────────────────────────────────────────────────────────
      'user-group.svg' || 'user-group_filled.svg' => Icons.group_rounded,
      'user-circle.svg' || 'my-profile.svg' => Icons.account_circle_rounded,
      'teacher.svg' || 'staff.svg' => Icons.badge_rounded,
      'children.svg' => Icons.child_care_rounded,
      // ── Communication ────────────────────────────────────────────────────
      'megaphone.svg' || 'announcements.svg' => Icons.campaign_rounded,
      'bell.svg' || 'bell_filled.svg' => Icons.notifications_rounded,
      'mail.svg' || 'envelope.svg' => Icons.mail_outline_rounded,
      'phone.svg' || 'device-phone.svg' || 'contact-school.svg' =>
        Icons.phone_rounded,
      'send.svg' => Icons.send_rounded,
      // ── Security ─────────────────────────────────────────────────────────
      'shield-check.svg' || 'shield-check_filled.svg' || 'shield.svg' =>
        Icons.verified_user_rounded,
      'lock.svg' => Icons.lock_outline_rounded,
      // ── Settings & system ────────────────────────────────────────────────
      'settings.svg' || 'cog-6-tooth.svg' || 'cog-6-tooth_filled.svg' ||
          'system.svg' =>
        Icons.settings_rounded,
      'cpu-chip.svg' => Icons.memory_rounded,
      // ── Actions ──────────────────────────────────────────────────────────
      'edit-pencil.svg' || 'edit-pencil_filled.svg' => Icons.edit_rounded,
      'hand-raised.svg' || 'hand-raised_filled.svg' || 'interventions.svg' =>
        Icons.pan_tool_rounded,
      'building-office.svg' || 'building-office_filled.svg' =>
        Icons.apartment_rounded,
      'discipline.svg' => Icons.gavel_rounded,
      'logout.svg' || 'door-open.svg' => Icons.logout_rounded,
      'audit.svg' || 'logs.svg' => Icons.history_edu_rounded,
      // ── Visibility ───────────────────────────────────────────────────────
      'eye.svg' => Icons.visibility_rounded,
      'eye_off.svg' => Icons.visibility_off_rounded,
      // ── Status ───────────────────────────────────────────────────────────
      'check-circle.svg' => Icons.check_circle_outline_rounded,
      'alert-circle.svg' => Icons.warning_amber_rounded,
      'info-circle.svg' => Icons.info_outline_rounded,
      // ── Connectivity ─────────────────────────────────────────────────────
      'wifi-off.svg' => Icons.wifi_off_rounded,
      'wifi-on.svg' => Icons.wifi_rounded,
      // ── Fallback ─────────────────────────────────────────────────────────
      _ => Icons.widgets_rounded,
    };
  }
}
