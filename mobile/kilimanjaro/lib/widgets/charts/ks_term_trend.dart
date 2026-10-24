import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/term_result_model.dart';
import 'ks_line_chart.dart';

/// Overall result per term as a line, plus a sentence that says what the line shows.
/// Built only from real term results; with fewer than two terms it says so instead of drawing anything.
class KSTermTrend extends StatelessWidget {
  const KSTermTrend({super.key, required this.terms, required this.name, this.height = 160});

  /// Term results in any order; they are sorted by start date here.
  final List<TermResultModel> terms;

  /// Who the trend is about, used in the sentence under the chart ("Neema", "You").
  final String name;
  final double height;

  static String _short(TermResultModel t, bool withYear) {
    final match = RegExp(r'(\d+)').firstMatch(t.label);
    final base = match != null ? 'T${match.group(1)}' : (t.label.length > 6 ? t.label.substring(0, 6) : t.label);
    if (!withYear) return base;
    final year = RegExp(r'(\d{4})').firstMatch(t.academicYear)?.group(1);
    return year == null ? base : "$base '${year.substring(2)}";
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...terms]..sort((a, b) {
        final da = a.startDate, db = b.startDate;
        if (da != null && db != null) return da.compareTo(db);
        return '${a.academicYear}${a.label}'.compareTo('${b.academicYear}${b.label}');
      });
    final scored = sorted.where((t) => t.overallScore > 0).toList();

    if (scored.length < 2) {
      return Text(
        'A trend line appears once there are results for at least two terms.',
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }

    final multiYear = scored.map((t) => t.academicYear).toSet().length > 1;
    final first = scored.first;
    final last = scored.last;
    final delta = last.overallScore - first.overallScore;
    final (sentence, color) = delta > 2
        ? ('$name up ${delta.toStringAsFixed(1)} points since ${first.label}.', AppColors.accentEmerald)
        : delta < -2
            ? ('$name down ${(-delta).toStringAsFixed(1)} points since ${first.label}.', AppColors.accentRose)
            : ('$name holding steady since ${first.label}.', AppColors.textSecondary);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KSLineChart(
          dataPoints: [
            for (var i = 0; i < scored.length; i++)
              ChartPoint(x: i.toDouble(), y: scored[i].overallScore, grade: scored[i].overallGrade.isEmpty ? null : scored[i].overallGrade),
          ],
          labels: [for (final t in scored) _short(t, multiYear)],
          lineColor: AppColors.skyBlue500,
          height: height,
        ),
        const SizedBox(height: 10),
        Text(sentence, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color)),
      ],
    );
  }
}
