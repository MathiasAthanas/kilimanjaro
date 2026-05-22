enum AttendanceStatus {
  present,
  absent,
  late,
  excused,
  noSchool,
}

class AttendanceRecordModel {
  const AttendanceRecordModel({
    required this.date,
    required this.status,
    this.note,
  });

  final DateTime date;
  final AttendanceStatus status;
  final String? note;
}
