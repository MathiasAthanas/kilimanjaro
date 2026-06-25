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

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      date: DateTime.parse(json['date'] as String),
      status: _parseStatus(json['status'] as String? ?? ''),
      note: json['note'] as String?,
    );
  }

  static AttendanceStatus _parseStatus(String raw) {
    switch (raw.toUpperCase()) {
      case 'PRESENT':
        return AttendanceStatus.present;
      case 'ABSENT':
        return AttendanceStatus.absent;
      case 'LATE':
        return AttendanceStatus.late;
      case 'EXCUSED':
        return AttendanceStatus.excused;
      case 'NO_SCHOOL':
        return AttendanceStatus.noSchool;
      default:
        return AttendanceStatus.present;
    }
  }
}
