import 'json_num.dart';

class ChildSummary {
  const ChildSummary({
    required this.id,
    required this.name,
    required this.registrationNumber,
    required this.classLabel,
    required this.academicYear,
    required this.overallScore,
    required this.overallGrade,
    required this.attendanceRate,
    required this.outstandingBalance,
    required this.currentTermId,
    this.educationStage,
    this.combinationCode,
  });

  final String id;
  final String name;
  final String registrationNumber;
  final String classLabel;
  final String academicYear;
  final double overallScore;
  final String overallGrade;
  final double attendanceRate;
  final double outstandingBalance;
  final String currentTermId;
  final String? educationStage;
  final String? combinationCode;

  factory ChildSummary.fromJson(Map<String, dynamic> json) {
    // The child record ({classLabel, academicYear, ...}) is merged with the
    // dashboard profile (the full student row); keep fields from both.
    final rawProfile = json['profile'];
    final profile = rawProfile is Map<String, dynamic>
        ? <String, dynamic>{...json, ...rawProfile}
        : json;

    final enrolments = profile['enrolments'];
    final enrolment = enrolments is List && enrolments.isNotEmpty && enrolments.first is Map
        ? Map<String, dynamic>.from(enrolments.first as Map)
        : const <String, dynamic>{};
    final enrolledClass = enrolment['class'] is Map
        ? Map<String, dynamic>.from(enrolment['class'] as Map)
        : const <String, dynamic>{};

    final currentTermId = profile['currentTermId'] as String? ??
        json['currentTermId'] as String? ??
        enrolment['termId'] as String? ??
        '';

    final performance = json['performance'] is Map
        ? Map<String, dynamic>.from(json['performance'] as Map)
        : null;
    final score = _overallScore(performance, currentTermId) ??
        numOf(json['overallScore'])?.toDouble() ??
        0.0;

    final invoices = json['invoices'] as List<dynamic>?;
    final outstandingBalance = invoices != null
        ? invoices.fold<double>(0.0, (sum, inv) {
            final m = inv as Map<String, dynamic>;
            return sum + (double.tryParse((m['outstandingBalance'] ?? '0').toString()) ?? 0.0);
          })
        : numOf(json['outstandingBalance'])?.toDouble() ?? 0.0;

    final first = profile['firstName'] as String? ?? '';
    final last = profile['lastName'] as String? ?? '';
    final combinedName = '$first $last'.trim();

    final stream = enrolledClass['stream'] as String?;
    final enrolledClassLabel = enrolledClass['name'] is String
        ? '${enrolledClass['name']}${stream != null && stream.isNotEmpty ? ' $stream' : ''}'
        : null;

    return ChildSummary(
      id: profile['id'] as String? ?? '',
      name: combinedName.isNotEmpty
          ? combinedName
          : (profile['name'] as String? ?? profile['fullName'] as String? ?? ''),
      registrationNumber: profile['registrationNumber'] as String? ?? profile['regNumber'] as String? ?? '',
      classLabel: _labelOf(profile['classLabel']) ??
          enrolledClassLabel ??
          _labelOf(profile['class']) ??
          '',
      academicYear: _labelOf(enrolment['academicYear']) ?? _labelOf(profile['academicYear']) ?? '',
      overallScore: score,
      overallGrade: performance?['overallGrade'] as String? ??
          json['overallGrade'] as String? ??
          (score > 0 ? _gradeFor(score) : ''),
      attendanceRate: _attendanceRate(json['attendanceSummary'], currentTermId) ??
          numOf(json['attendanceRate'])?.toDouble() ??
          0.0,
      outstandingBalance: outstandingBalance,
      currentTermId: currentTermId,
      educationStage: profile['educationStage'] as String? ??
          enrolledClass['educationStage'] as String? ??
          json['educationStage'] as String?,
      combinationCode: profile['combinationCode'] as String? ?? json['combinationCode'] as String?,
    );
  }

  /// Attendance summary arrives either as one object or as a list of
  /// per-term summaries; prefer the current term.
  static double? _attendanceRate(Object? summary, String currentTermId) {
    if (summary is Map) return numOf(summary['attendanceRate'])?.toDouble();
    if (summary is List && summary.isNotEmpty) {
      final rows = summary.whereType<Map>().toList();
      final match = rows.where((r) => r['termId'] == currentTermId).firstOrNull ?? rows.firstOrNull;
      return numOf(match?['attendanceRate'])?.toDouble();
    }
    return null;
  }

  static double? _overallScore(Map<String, dynamic>? performance, String currentTermId) {
    if (performance == null) return null;
    final direct = numOf(performance['overallScore']);
    if (direct != null) return direct.toDouble();
    final summary = performance['overallSummary'];
    if (summary is Map) {
      final avg = numOf(summary['overallAverage'] ?? summary['average']);
      if (avg != null) return avg.toDouble();
    }
    final history = performance['academicHistory'];
    if (history is List && history.isNotEmpty) {
      final rows = history.whereType<Map>().toList();
      final termRows = rows.where((r) => r['termId'] == currentTermId).toList();
      final used = termRows.isNotEmpty ? termRows : rows;
      final scores = used
          .map((r) => numOf(r['weightedTotal'] ?? r['score'])?.toDouble())
          .whereType<double>()
          .toList();
      if (scores.isNotEmpty) return scores.reduce((a, b) => a + b) / scores.length;
    }
    return null;
  }

  static String _gradeFor(double score) {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /// A label that the backend sends either as a plain string or as `{name}`.
  static String? _labelOf(Object? value) {
    if (value is String) return value;
    if (value is Map) return value['name'] as String?;
    return null;
  }

  String get firstName => name.split(' ').first;
  bool get isFullyPaid => outstandingBalance <= 0;
  String get stageLabel {
    switch (educationStage) {
      case 'PRIMARY':
        return 'Primary';
      case 'A_LEVEL':
        return combinationCode == null ? 'A-Level' : 'A-Level $combinationCode';
      case 'O_LEVEL':
        return 'O-Level';
      default:
        return classLabel;
    }
  }
}
