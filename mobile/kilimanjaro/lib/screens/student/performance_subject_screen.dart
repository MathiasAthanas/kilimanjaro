import 'package:flutter/material.dart';

import 'subject_performance_detail_screen.dart';

class PerformanceSubjectScreen extends StatelessWidget {
  const PerformanceSubjectScreen({
    super.key,
    required this.subjectId,
  });

  final String subjectId;

  @override
  Widget build(BuildContext context) {
    return SubjectPerformanceDetailScreen(
      subjectId: subjectId,
      title: 'Performance Deep-Dive',
    );
  }
}
