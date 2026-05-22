import 'package:intl/intl.dart';

final _moneyFormat = NumberFormat('#,###');
final _dateFormat = DateFormat('d MMMM y');
final _shortDateFormat = DateFormat('d MMM y');
final _monthFormat = DateFormat('MMMM y');
final _weekdayDateFormat = DateFormat('EEEE d MMMM y');

String formatParentTzs(double value) => 'TZS ${_moneyFormat.format(value)}';

String formatParentShortTzs(double value) {
  if (value >= 1000) {
    return 'TZS ${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}K';
  }
  return formatParentTzs(value);
}

String formatParentLongDate(DateTime value) => _dateFormat.format(value);

String formatParentShortDate(DateTime value) => _shortDateFormat.format(value);

String formatParentMonth(DateTime value) => _monthFormat.format(value);

String formatParentWeekdayDate(DateTime value) => _weekdayDateFormat.format(value);
