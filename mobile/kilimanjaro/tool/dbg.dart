import 'dart:convert';
import 'dart:io';
import 'package:kilimanjaro/models/child_summary_model.dart';

void main() {
  final kids = jsonDecode(File('C:/kt/dbg/children.json').readAsStringSync())['data']['children'] as List;
  final dash = jsonDecode(File('C:/kt/dbg/dash.json').readAsStringSync())['data'] as Map<String, dynamic>;
  final c = ChildSummary.fromJson({...(kids.first as Map<String, dynamic>), ...dash});
  print('${c.name} | ${c.classLabel} | ${c.academicYear} | ${c.overallScore} ${c.overallGrade} | ${c.attendanceRate} | ${c.currentTermId}');
  final d = ChildSummary.fromJson(dash);
  print('${d.name} | ${d.classLabel} | ${d.overallScore}');
}
