import 'package:flutter/material.dart';

import '../../models/subject_result_model.dart';

class KSAssessmentRow extends StatelessWidget {
  const KSAssessmentRow({
    super.key,
    required this.assessment,
  });

  final AssessmentScore assessment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              assessment.label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          Text(
            '${assessment.score.toStringAsFixed(0)}%',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}
