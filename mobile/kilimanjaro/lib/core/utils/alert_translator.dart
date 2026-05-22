import '../../models/performance_snapshot_model.dart';

class AlertTranslator {
  const AlertTranslator._();

  static String parentMessage(
    PerformanceAlertType type, {
    required String studentName,
    required String subjectName,
  }) {
    switch (type) {
      case PerformanceAlertType.atRisk:
        return '$studentName may need extra help with $subjectName.';
      case PerformanceAlertType.suddenDecline:
        return "$studentName's $subjectName performance dropped this term.";
      case PerformanceAlertType.consistentExcellence:
        return '$studentName is consistently excelling in $subjectName.';
    }
  }

  static String severityLabel(PerformanceAlertSeverity severity) {
    switch (severity) {
      case PerformanceAlertSeverity.critical:
        return 'Needs Urgent Attention';
      case PerformanceAlertSeverity.high:
        return 'Needs Attention';
      case PerformanceAlertSeverity.low:
        return 'Just a Notice';
    }
  }
}
