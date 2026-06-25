import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';

class KSAttendanceCalendar extends StatefulWidget {
  const KSAttendanceCalendar({
    super.key,
    required this.records,
    required this.currentMonth,
    required this.onMonthChanged,
    this.selectedDay,
    this.onDaySelected,
  });

  final Map<DateTime, AttendanceStatus> records;
  final DateTime currentMonth;
  final ValueChanged<DateTime> onMonthChanged;
  final DateTime? selectedDay;
  final ValueChanged<DateTime>? onDaySelected;

  @override
  State<KSAttendanceCalendar> createState() => _KSAttendanceCalendarState();
}

class _KSAttendanceCalendarState extends State<KSAttendanceCalendar> {
  late DateTime _focusedDay;

  @override
  void initState() {
    super.initState();
    _focusedDay = widget.currentMonth;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TableCalendar<AttendanceStatus>(
      firstDay: DateTime(2025, 1, 1),
      lastDay: DateTime(2026, 12, 31),
      focusedDay: _focusedDay,
      headerVisible: false,
      selectedDayPredicate: (day) =>
          widget.selectedDay != null && isSameDay(widget.selectedDay, day),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: TextStyle(
          fontSize: 11,
          color: isDark ? AppColors.darkMuted : AppColors.textMuted,
        ),
        weekendStyle: TextStyle(
          fontSize: 11,
          color: AppColors.accentRose.withValues(alpha: isDark ? 0.5 : 0.6),
        ),
      ),
      calendarStyle: CalendarStyle(
        outsideDaysVisible: false,
        cellMargin: const EdgeInsets.all(4),
        defaultTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.darkText : AppColors.textPrimary,
        ),
        weekendTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.darkMuted : AppColors.textMuted,
        ),
        todayDecoration: const BoxDecoration(
          color: AppColors.skyBlue500,
          shape: BoxShape.circle,
        ),
        selectedDecoration: BoxDecoration(
          color: AppColors.skyBlue500.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.skyBlue500, width: 1.5),
        ),
      ),
      calendarBuilders: CalendarBuilders(
        defaultBuilder: (context, day, focusedDay) =>
            _dayCell(context, day, false, false),
        todayBuilder: (context, day, focusedDay) =>
            _dayCell(context, day, true, false),
        selectedBuilder: (context, day, focusedDay) =>
            _dayCell(context, day, false, true),
      ),
      onDaySelected: (selected, focused) {
        setState(() => _focusedDay = focused);
        widget.onDaySelected?.call(selected);
      },
      onPageChanged: (focusedDay) {
        setState(() => _focusedDay = focusedDay);
        widget.onMonthChanged(focusedDay);
      },
    );
  }

  Widget _dayCell(BuildContext context, DateTime day, bool isToday, bool isSelected) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final normalized = DateTime(day.year, day.month, day.day);
    final status = widget.records[normalized];
    Color textColor = isDark ? AppColors.darkText : AppColors.textPrimary;
    Color? dotColor;
    switch (status) {
      case AttendanceStatus.absent:
        textColor = AppColors.accentRose;
        dotColor = AppColors.accentRose;
      case AttendanceStatus.late:
        dotColor = AppColors.accentAmber;
      case AttendanceStatus.excused:
        dotColor = AppColors.accentIndigo;
      case AttendanceStatus.present:
        dotColor = AppColors.accentEmerald;
      case AttendanceStatus.noSchool:
      case null:
        dotColor = null;
    }

    return Container(
      decoration: isSelected
          ? BoxDecoration(
              color: AppColors.skyBlue500.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.skyBlue500, width: 1.5),
            )
          : null,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: isToday ? 28 : null,
            height: isToday ? 28 : null,
            alignment: Alignment.center,
            decoration: isToday
                ? const BoxDecoration(
                    color: AppColors.skyBlue500,
                    shape: BoxShape.circle,
                  )
                : null,
            child: Text(
              '${day.day}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isToday ? AppColors.white : textColor,
              ),
            ),
          ),
          const SizedBox(height: 3),
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: dotColor ?? Colors.transparent,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }
}
