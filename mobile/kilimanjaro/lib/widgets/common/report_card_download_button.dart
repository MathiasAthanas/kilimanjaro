import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/report_card_pdf_service.dart';
import '../../core/theme/app_colors.dart';
import '../../models/report_card_model.dart';
import '../../models/subject_result_model.dart';

/// Floating download button for report cards.
/// Handles loading state, error display, and file open after generation.
class ReportCardDownloadButton extends ConsumerStatefulWidget {
  const ReportCardDownloadButton({
    super.key,
    required this.studentName,
    required this.registrationNumber,
    required this.termTitle,
    required this.classLabel,
    required this.stream,
    required this.stageLabel,
    required this.combinationCode,
    required this.academicYear,
    required this.overallScore,
    required this.overallGrade,
    required this.rank,
    required this.totalStudents,
    required this.divisionSummary,
    required this.subjects,
    required this.teacherRemark,
    required this.principalRemark,
  });

  final String studentName;
  final String registrationNumber;
  final String termTitle;
  final String classLabel;
  final String stream;
  final String stageLabel;
  final String? combinationCode;
  final String academicYear;
  final double overallScore;
  final String overallGrade;
  final int rank;
  final int totalStudents;
  final String? divisionSummary;
  final List<SubjectResultModel> subjects;
  final ReportCardRemark teacherRemark;
  final ReportCardRemark principalRemark;

  @override
  ConsumerState<ReportCardDownloadButton> createState() =>
      _ReportCardDownloadButtonState();
}

class _ReportCardDownloadButtonState
    extends ConsumerState<ReportCardDownloadButton> {
  bool _generating = false;

  Future<void> _download() async {
    if (_generating) return;
    setState(() => _generating = true);

    try {
      final svc = ReportCardPdfService();
      final path = await svc.generateAndSave(
        studentName: widget.studentName,
        registrationNumber: widget.registrationNumber,
        termTitle: widget.termTitle,
        classLabel: widget.classLabel,
        stream: widget.stream,
        stageLabel: widget.stageLabel,
        combinationCode: widget.combinationCode,
        academicYear: widget.academicYear,
        overallScore: widget.overallScore,
        overallGrade: widget.overallGrade,
        rank: widget.rank,
        totalStudents: widget.totalStudents,
        divisionSummary: widget.divisionSummary,
        subjects: widget.subjects,
        teacherRemark: widget.teacherRemark,
        principalRemark: widget.principalRemark,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.accentEmerald,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          duration: const Duration(seconds: 5),
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Report card saved!',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: () async {
                  ScaffoldMessenger.of(context).hideCurrentSnackBar();
                  await openPdfFile(path);
                },
                child: const Text(
                  'OPEN',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.accentRose,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          content: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Failed to generate PDF. Please try again.',
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      onPressed: _generating ? null : _download,
      backgroundColor: AppColors.skyBlue700,
      foregroundColor: Colors.white,
      elevation: 4,
      icon: _generating
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Colors.white,
              ),
            )
          : const Icon(Icons.download_rounded),
      label: Text(
        _generating ? 'Generating…' : 'Download PDF',
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}
