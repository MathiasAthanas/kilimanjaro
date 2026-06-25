import 'dart:io';

import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../models/report_card_model.dart';
import '../../models/subject_result_model.dart';

// ─── PDF Brand palette ────────────────────────────────────────────────────────

final _navy = PdfColor.fromHex('#075985');
final _primary = PdfColor.fromHex('#0369A1');
final _skyBlue = PdfColor.fromHex('#0EA5E9');
final _skyBorder = PdfColor.fromHex('#BAE6FD');
final _paperYellow = PdfColor.fromHex('#FDF8ED');
final _paperBorder = PdfColor.fromHex('#E8DCC0');
final _indigo = PdfColor.fromHex('#4338CA');
final _indigoLight = PdfColor.fromHex('#EEF2FF');
final _emerald = PdfColor.fromHex('#10B981');
final _rose = PdfColor.fromHex('#F43F5E');
final _roseLight = PdfColor.fromHex('#FFF1F3');
final _amber = PdfColor.fromHex('#F59E0B');
final _white = PdfColors.white;
final _textDark = PdfColor.fromHex('#0F172A');
final _textGrey = PdfColor.fromHex('#475569');
final _textMuted = PdfColor.fromHex('#94A3B8');
final _offWhite = PdfColor.fromHex('#F8FAFC');
final _tableAlt = PdfColor.fromHex('#F0F9FF');

// ─── Service ──────────────────────────────────────────────────────────────────

class ReportCardPdfService {
  /// Generates a branded PDF report card and saves it to the app's documents
  /// directory. Returns the saved file path.
  Future<String> generateAndSave({
    required String studentName,
    required String registrationNumber,
    required String termTitle,
    required String classLabel,
    required String stream,
    required String stageLabel,
    required String? combinationCode,
    required String academicYear,
    required double overallScore,
    required String overallGrade,
    required int rank,
    required int totalStudents,
    required String? divisionSummary,
    required List<SubjectResultModel> subjects,
    required ReportCardRemark teacherRemark,
    required ReportCardRemark principalRemark,
  }) async {
    // Load logo asset
    final logoData = await rootBundle.load('assets/images/kilimanjaro_logo.png');
    final logoImage = pw.MemoryImage(logoData.buffer.asUint8List());

    final generatedAt = DateFormat('dd MMMM yyyy').format(DateTime.now());
    final classDisplay = stream.isNotEmpty ? '$classLabel $stream' : classLabel;

    final doc = pw.Document(
      title: 'KMS Report Card – $studentName – $termTitle',
      author: 'Kilimanjaro Schools',
      creator: 'KMS Mobile App',
      subject: 'Academic Report Card',
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(28, 24, 28, 28),
        header: (ctx) => _header(logoImage),
        footer: (ctx) => _footer(generatedAt, ctx),
        build: (ctx) => [
          _titleBar(termTitle, stageLabel, combinationCode),
          pw.SizedBox(height: 14),
          _studentAndPerformanceRow(
            studentName: studentName,
            registrationNumber: registrationNumber,
            classDisplay: classDisplay,
            stageLabel: stageLabel,
            combinationCode: combinationCode,
            academicYear: academicYear,
            overallScore: overallScore,
            overallGrade: overallGrade,
            rank: rank,
            totalStudents: totalStudents,
          ),
          if (divisionSummary != null) ...[
            pw.SizedBox(height: 10),
            _divisionBox(divisionSummary),
          ],
          pw.SizedBox(height: 14),
          _subjectTable(subjects),
          pw.SizedBox(height: 14),
          _remarkBox(
            title: "Class Teacher's Remarks",
            message: teacherRemark.message,
            author: teacherRemark.author,
            role: teacherRemark.role,
          ),
          pw.SizedBox(height: 10),
          _remarkBox(
            title: "Principal's Remarks",
            message: principalRemark.message,
            author: principalRemark.author,
            role: principalRemark.role,
          ),
          pw.SizedBox(height: 14),
          _signatureRow(),
        ],
      ),
    );

    final bytes = await doc.save();

    // Save to app documents directory (no permissions needed)
    final dir = await getApplicationDocumentsDirectory();
    final reportsDir = Directory('${dir.path}/KMS_Reports');
    if (!reportsDir.existsSync()) reportsDir.createSync(recursive: true);

    final fileName =
        'KMS_${_safe(studentName)}_${_safe(termTitle)}.pdf';
    final filePath = '${reportsDir.path}/$fileName';

    await File(filePath).writeAsBytes(bytes);
    return filePath;
  }

  // ─── Page header ─────────────────────────────────────────────────────────────

  pw.Widget _header(pw.MemoryImage logo) => pw.Container(
        margin: const pw.EdgeInsets.only(bottom: 10),
        padding: const pw.EdgeInsets.only(bottom: 10),
        decoration: pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: _skyBorder, width: 1)),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Image(logo, width: 52, height: 52),
            pw.SizedBox(width: 12),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'KILIMANJARO SCHOOLS',
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                      color: _navy,
                      letterSpacing: 1.2,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    '"Excellence in Every Child"',
                    style: pw.TextStyle(
                      fontSize: 8.5,
                      fontStyle: pw.FontStyle.italic,
                      color: _textGrey,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Moshi, Kilimanjaro, Tanzania  •  www.kilimanjaroschools.site',
                    style: pw.TextStyle(fontSize: 7.5, color: _textMuted),
                  ),
                ],
              ),
            ),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: pw.BoxDecoration(
                color: _navy,
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    'OFFICIAL DOCUMENT',
                    style: pw.TextStyle(
                      fontSize: 6.5,
                      fontWeight: pw.FontWeight.bold,
                      color: _white,
                      letterSpacing: 0.8,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    'Kilimanjaro Schools',
                    style: pw.TextStyle(fontSize: 7, color: _skyBorder),
                  ),
                  pw.Text(
                    'Academic Report Card',
                    style: pw.TextStyle(fontSize: 7, color: _skyBorder),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  // ─── Document title bar ───────────────────────────────────────────────────────

  pw.Widget _titleBar(
    String termTitle,
    String stageLabel,
    String? combinationCode,
  ) {
    final combo = combinationCode != null ? '  ·  $combinationCode' : '';
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.symmetric(vertical: 12, horizontal: 20),
      decoration: pw.BoxDecoration(
        color: _navy,
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
      ),
      child: pw.Column(
        children: [
          pw.Text(
            'ACADEMIC REPORT CARD',
            style: pw.TextStyle(
              fontSize: 14,
              fontWeight: pw.FontWeight.bold,
              color: _white,
              letterSpacing: 2.5,
            ),
            textAlign: pw.TextAlign.center,
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            '$termTitle  ·  $stageLabel$combo',
            style: pw.TextStyle(
              fontSize: 9,
              color: _skyBorder,
              letterSpacing: 0.5,
            ),
            textAlign: pw.TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ─── Student info + performance summary ───────────────────────────────────────

  pw.Widget _studentAndPerformanceRow({
    required String studentName,
    required String registrationNumber,
    required String classDisplay,
    required String stageLabel,
    required String? combinationCode,
    required String academicYear,
    required double overallScore,
    required String overallGrade,
    required int rank,
    required int totalStudents,
  }) {
    final gradeCol = _gradeColor(overallGrade);
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        // Student details
        pw.Expanded(
          flex: 55,
          child: pw.Container(
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              color: _offWhite,
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
              border: pw.Border.all(color: _skyBorder, width: 0.5),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _sectionLabel('Student Details'),
                pw.SizedBox(height: 9),
                _infoRow('Full Name', studentName),
                _infoRow('Registration No.', registrationNumber),
                _infoRow('Class', classDisplay),
                _infoRow('Academic Stage', stageLabel),
                if (combinationCode != null)
                  _infoRow('Combination', combinationCode),
                _infoRow('Academic Year', academicYear),
              ],
            ),
          ),
        ),
        pw.SizedBox(width: 10),
        // Performance summary
        pw.Expanded(
          flex: 40,
          child: pw.Container(
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              color: _offWhite,
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
              border: pw.Border.all(color: _skyBorder, width: 0.5),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _sectionLabel('Performance Summary'),
                pw.SizedBox(height: 9),
                _infoRow('Overall Score', '${overallScore.toStringAsFixed(1)}%'),
                _infoRow('Class Rank', '#$rank of $totalStudents students'),
                pw.SizedBox(height: 10),
                // Big grade badge
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.all(12),
                  decoration: pw.BoxDecoration(
                    color: gradeCol.shade(0.92),
                    borderRadius:
                        const pw.BorderRadius.all(pw.Radius.circular(8)),
                    border: pw.Border.all(color: gradeCol, width: 0.8),
                  ),
                  child: pw.Column(
                    children: [
                      pw.Text(
                        overallGrade,
                        style: pw.TextStyle(
                          fontSize: 34,
                          fontWeight: pw.FontWeight.bold,
                          color: gradeCol,
                        ),
                        textAlign: pw.TextAlign.center,
                      ),
                      pw.Text(
                        'Overall Grade',
                        style: pw.TextStyle(
                          fontSize: 8,
                          color: gradeCol,
                        ),
                        textAlign: pw.TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ─── Division summary ─────────────────────────────────────────────────────────

  pw.Widget _divisionBox(String summary) => pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(10),
        decoration: pw.BoxDecoration(
          color: _indigoLight,
          borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
          border: pw.Border.all(color: _indigo, width: 0.5),
        ),
        child: pw.Row(
          children: [
            pw.Container(width: 4, height: 36, color: _indigo),
            pw.SizedBox(width: 10),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'STAGE SUMMARY',
                    style: pw.TextStyle(
                      fontSize: 8,
                      fontWeight: pw.FontWeight.bold,
                      color: _indigo,
                      letterSpacing: 0.6,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    summary,
                    style: pw.TextStyle(fontSize: 9, color: _textDark),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  // ─── Subjects table ───────────────────────────────────────────────────────────

  pw.Widget _subjectTable(List<SubjectResultModel> subjects) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _sectionLabel('Subject Results'),
          pw.SizedBox(height: 8),
          pw.Table(
            border: pw.TableBorder.all(color: _skyBorder, width: 0.5),
            columnWidths: const {
              0: pw.FlexColumnWidth(3.2),
              1: pw.FlexColumnWidth(1.4),
              2: pw.FlexColumnWidth(1.0),
              3: pw.FlexColumnWidth(1.6),
            },
            children: [
              // Header
              pw.TableRow(
                decoration: pw.BoxDecoration(color: _navy),
                children: [
                  _th('Subject'),
                  _th('Score'),
                  _th('Grade'),
                  _th('Remarks'),
                ],
              ),
              // Data rows
              ...subjects.asMap().entries.map((e) {
                final i = e.key;
                final s = e.value;
                final bg = !s.isPassing
                    ? _roseLight
                    : i.isOdd
                        ? _tableAlt
                        : _white;
                return pw.TableRow(
                  decoration: pw.BoxDecoration(color: bg),
                  children: [
                    _td(s.name),
                    _td('${s.score.toStringAsFixed(0)}%'),
                    _td(
                      s.grade,
                      bold: true,
                      color: s.isPassing ? _emerald : _rose,
                    ),
                    _td(_gradeRemark(s.grade), small: true),
                  ],
                );
              }),
            ],
          ),
          pw.SizedBox(height: 5),
          pw.Row(
            children: [
              pw.Container(width: 10, height: 8, color: _tableAlt),
              pw.SizedBox(width: 4),
              pw.Text(
                'Pass ≥ 70%',
                style: pw.TextStyle(fontSize: 7, color: _textMuted),
              ),
              pw.SizedBox(width: 14),
              pw.Container(width: 10, height: 8, color: _roseLight),
              pw.SizedBox(width: 4),
              pw.Text(
                'Needs improvement  < 70%',
                style: pw.TextStyle(fontSize: 7, color: _textMuted),
              ),
            ],
          ),
        ],
      );

  // ─── Remark box ───────────────────────────────────────────────────────────────

  pw.Widget _remarkBox({
    required String title,
    required String message,
    required String author,
    required String role,
  }) =>
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: pw.BoxDecoration(
          color: _offWhite,
          borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
          border: pw.Border.all(color: _skyBorder, width: 0.5),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  title.toUpperCase(),
                  style: pw.TextStyle(
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold,
                    color: _navy,
                    letterSpacing: 0.6,
                  ),
                ),
                pw.Text(
                  '$role — $author',
                  style: pw.TextStyle(
                    fontSize: 8,
                    fontStyle: pw.FontStyle.italic,
                    color: _textGrey,
                  ),
                ),
              ],
            ),
            pw.SizedBox(height: 4),
            pw.Divider(color: _skyBorder, height: 1),
            pw.SizedBox(height: 7),
            pw.Text(
              '"$message"',
              style: pw.TextStyle(
                fontSize: 9.5,
                fontStyle: pw.FontStyle.italic,
                color: _textDark,
              ),
            ),
            pw.SizedBox(height: 12),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.end,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Container(
                      width: 110,
                      height: 0.5,
                      color: _textGrey,
                    ),
                    pw.SizedBox(height: 4),
                    pw.Text(
                      author,
                      style: pw.TextStyle(
                        fontSize: 8.5,
                        fontWeight: pw.FontWeight.bold,
                        color: _textDark,
                      ),
                    ),
                    pw.Text(
                      role,
                      style: pw.TextStyle(fontSize: 8, color: _textGrey),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      );

  // ─── Signature row ────────────────────────────────────────────────────────────

  pw.Widget _signatureRow() => pw.Container(
        padding: const pw.EdgeInsets.all(14),
        decoration: pw.BoxDecoration(
          color: _paperYellow,
          borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
          border: pw.Border.all(color: _paperBorder, width: 0.5),
        ),
        child: pw.Row(
          children: [
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'SCHOOL STAMP',
                    style: pw.TextStyle(
                      fontSize: 7,
                      letterSpacing: 0.8,
                      color: _textMuted,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 28),
                  pw.Container(
                    width: 90,
                    height: 0.5,
                    color: _textGrey,
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: 24),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'PARENT / GUARDIAN SIGNATURE',
                    style: pw.TextStyle(
                      fontSize: 7,
                      letterSpacing: 0.8,
                      color: _textMuted,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 28),
                  pw.Container(
                    width: 90,
                    height: 0.5,
                    color: _textGrey,
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: 24),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'DATE RECEIVED',
                    style: pw.TextStyle(
                      fontSize: 7,
                      letterSpacing: 0.8,
                      color: _textMuted,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 28),
                  pw.Container(
                    width: 90,
                    height: 0.5,
                    color: _textGrey,
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  // ─── Page footer ──────────────────────────────────────────────────────────────

  pw.Widget _footer(String generatedAt, pw.Context ctx) => pw.Container(
        margin: const pw.EdgeInsets.only(top: 8),
        padding: const pw.EdgeInsets.only(top: 8),
        decoration: pw.BoxDecoration(
          border: pw.Border(
            top: pw.BorderSide(color: _skyBorder, width: 0.5),
          ),
        ),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'Generated via Kilimanjaro Schools App  ·  $generatedAt  ·  Confidential',
              style: pw.TextStyle(fontSize: 7, color: _textMuted),
            ),
            pw.Text(
              'Page ${ctx.pageNumber} of ${ctx.pagesCount}',
              style: pw.TextStyle(fontSize: 7, color: _textMuted),
            ),
          ],
        ),
      );

  // ─── Reusable primitives ──────────────────────────────────────────────────────

  pw.Widget _sectionLabel(String label) => pw.Row(
        children: [
          pw.Container(width: 3, height: 14, color: _primary),
          pw.SizedBox(width: 6),
          pw.Text(
            label.toUpperCase(),
            style: pw.TextStyle(
              fontSize: 8.5,
              fontWeight: pw.FontWeight.bold,
              color: _navy,
              letterSpacing: 0.8,
            ),
          ),
        ],
      );

  pw.Widget _infoRow(String label, String value) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 5),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.SizedBox(
              width: 96,
              child: pw.Text(
                label,
                style: pw.TextStyle(fontSize: 8, color: _textGrey),
              ),
            ),
            pw.Text('  :  ', style: pw.TextStyle(fontSize: 8, color: _textMuted)),
            pw.Expanded(
              child: pw.Text(
                value,
                style: pw.TextStyle(
                  fontSize: 9,
                  fontWeight: pw.FontWeight.bold,
                  color: _textDark,
                ),
              ),
            ),
          ],
        ),
      );

  pw.Widget _th(String text) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: pw.Text(
          text,
          style: pw.TextStyle(
            fontSize: 9,
            fontWeight: pw.FontWeight.bold,
            color: _white,
          ),
        ),
      );

  pw.Widget _td(
    String text, {
    bool bold = false,
    bool small = false,
    PdfColor? color,
  }) =>
      pw.Padding(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: pw.Text(
          text,
          style: pw.TextStyle(
            fontSize: small ? 8 : 9,
            fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
            color: color ?? _textDark,
          ),
        ),
      );

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  String _gradeRemark(String grade) => switch (grade.toUpperCase()) {
        'A' || 'A+' => 'Outstanding',
        'A-' || 'B+' => 'Very Good',
        'B' || 'B-' => 'Good',
        'C+' || 'C' => 'Satisfactory',
        'C-' || 'D' => 'Needs Effort',
        'E' || 'F' || 'X' => 'Unsatisfactory',
        _ => 'Satisfactory',
      };

  PdfColor _gradeColor(String grade) => switch (grade.toUpperCase()) {
        'A' || 'A+' || 'A-' => _emerald,
        'B+' || 'B' || 'B-' => _skyBlue,
        'C+' || 'C' || 'C-' => _amber,
        _ => _rose,
      };

  String _safe(String s) => s.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
}

// ─── Helper to open a saved PDF ───────────────────────────────────────────────

Future<void> openPdfFile(String path) async {
  await OpenFile.open(path);
}
