import 'package:intl/intl.dart';

final _moneyFormat = NumberFormat('#,###');
final _dateFormat = DateFormat('d MMMM y');
final _shortDateFormat = DateFormat('d MMM y');
final _monthYearFormat = DateFormat('MMMM y');

String formatTzs(double value) => 'TZS ${_moneyFormat.format(value)}';

String formatLongDate(DateTime value) => _dateFormat.format(value);

String formatShortDate(DateTime value) => _shortDateFormat.format(value);

String formatMonthYear(DateTime value) => _monthYearFormat.format(value);

String timeAgo(DateTime value) {
  final now = DateTime(2026, 3, 21);
  final diff = now.difference(value).inDays;
  if (diff <= 0) return 'Today';
  if (diff == 1) return '1 day ago';
  if (diff < 7) return '$diff days ago';
  if (diff < 14) return '1 week ago';
  return '${(diff / 7).floor()} weeks ago';
}
