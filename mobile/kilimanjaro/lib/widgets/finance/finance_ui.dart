import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_failure.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/services/api/finance_documents.dart';
import '../../core/theme/app_colors.dart';
import '../../models/invoice_model.dart';
import '../../models/receipt_model.dart';

/// Wraps content in the card style of whichever role is looking (student or parent).
typedef FinanceCard = Widget Function({required Widget child, VoidCallback? onTap});

final financeDocumentsProvider = Provider<FinanceDocuments>((ref) => FinanceDocuments(ref.watch(secureStorageProvider)));

final _moneyFormat = NumberFormat('#,###');
final _dateFormat = DateFormat('d MMM y');

String tzs(double value) => 'TZS ${_moneyFormat.format(value)}';
String financeDate(DateTime value) => _dateFormat.format(value);

Color invoiceColor(InvoiceModel invoice) {
  if (invoice.isCancelled || invoice.isWaived) return AppColors.textMuted;
  if (invoice.isSettled) return AppColors.accentEmerald;
  if (invoice.isOverdue) return AppColors.accentRose;
  return AppColors.accentAmber;
}

/// A small coloured pill for an invoice's state ("Overdue", "Part paid", "Paid"...).
class InvoiceStatusPill extends StatelessWidget {
  const InvoiceStatusPill({super.key, required this.invoice});
  final InvoiceModel invoice;

  @override
  Widget build(BuildContext context) {
    final color = invoiceColor(invoice);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
      child: Text(invoice.statusLabel, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
    );
  }
}

String dueLine(InvoiceModel invoice) {
  if (invoice.isCancelled) return 'This invoice was cancelled by the school.';
  if (invoice.isWaived) return 'The school waived this invoice.';
  if (invoice.isSettled) return 'Fully paid.';
  final days = invoice.dueDate.difference(DateTime.now()).inDays;
  if (invoice.dueDate.isBefore(DateTime.now())) {
    final late = days.abs();
    return 'Was due ${financeDate(invoice.dueDate)} · $late day${late == 1 ? '' : 's'} overdue';
  }
  return 'Due ${financeDate(invoice.dueDate)} · ${days == 0 ? 'today' : 'in $days day${days == 1 ? '' : 's'}'}';
}

/// The headline card for one invoice: what it is for, what is left, how far along it is.
class InvoiceHeadline extends StatelessWidget {
  const InvoiceHeadline({super.key, required this.invoice, required this.card, this.onTap, this.showStudent = false});

  final InvoiceModel invoice;
  final FinanceCard card;
  final VoidCallback? onTap;
  final bool showStudent;

  @override
  Widget build(BuildContext context) {
    final color = invoiceColor(invoice);
    final text = Theme.of(context).textTheme;
    return card(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(invoice.heading, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                if (showStudent && invoice.studentName.isNotEmpty)
                  Text(invoice.studentName, style: text.bodySmall),
                if (invoice.invoiceNumber.isNotEmpty)
                  Text(invoice.invoiceNumber, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ]),
            ),
            InvoiceStatusPill(invoice: invoice),
            if (onTap != null) const Icon(Icons.chevron_right_rounded),
          ]),
          const SizedBox(height: 12),
          Text(
            invoice.isCancelled || invoice.isWaived ? tzs(0) : tzs(invoice.outstandingAmount),
            style: text.headlineMedium?.copyWith(color: color, fontWeight: FontWeight.w900),
          ),
          Text(invoice.isSettled ? 'nothing left to pay' : 'left to pay', style: text.bodySmall),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: invoice.isCancelled || invoice.isWaived ? 0 : invoice.progress,
              minHeight: 9,
              color: invoice.isSettled ? AppColors.accentEmerald : AppColors.skyBlue600,
              backgroundColor: AppColors.border,
            ),
          ),
          const SizedBox(height: 8),
          Text('${tzs(invoice.paidAmount)} paid of ${tzs(invoice.totalAmount)}', style: text.bodyMedium),
          const SizedBox(height: 4),
          Text(dueLine(invoice), style: text.bodySmall?.copyWith(color: invoice.isOverdue ? AppColors.accentRose : null)),
        ],
      ),
    );
  }
}

/// One row per invoice (a term each): used for the "All invoices" list.
class InvoiceRow extends StatelessWidget {
  const InvoiceRow({super.key, required this.invoice, required this.card, required this.onTap, this.showStudent = false});

  final InvoiceModel invoice;
  final FinanceCard card;
  final VoidCallback onTap;
  final bool showStudent;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final color = invoiceColor(invoice);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: card(
        onTap: onTap,
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
            child: Icon(Icons.receipt_long_rounded, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(invoice.heading, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              Text(
                [if (showStudent && invoice.studentName.isNotEmpty) invoice.studentName, 'Due ${financeDate(invoice.dueDate)}'].join(' · '),
                style: text.bodySmall,
              ),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(
              invoice.isCancelled || invoice.isWaived ? tzs(invoice.totalAmount) : tzs(invoice.isSettled ? invoice.totalAmount : invoice.outstandingAmount),
              style: text.titleSmall?.copyWith(color: color, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            InvoiceStatusPill(invoice: invoice),
          ]),
        ]),
      ),
    );
  }
}

/// Fee lines, discount, totals — the arithmetic of one invoice.
class InvoiceBreakdown extends StatelessWidget {
  const InvoiceBreakdown({super.key, required this.invoice, required this.card});
  final InvoiceModel invoice;
  final FinanceCard card;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget row(String label, String value, {Color? color, bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Expanded(child: Text(label, style: bold ? text.titleSmall : text.bodyMedium)),
            Text(value, style: (bold ? text.titleSmall : text.bodyMedium)?.copyWith(color: color, fontWeight: bold ? FontWeight.w900 : FontWeight.w700)),
          ]),
        );
    return card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Fee breakdown', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        if (invoice.items.isEmpty) Text('Fee lines are not available for this invoice.', style: text.bodySmall),
        for (final item in invoice.items) row(item.label, tzs(item.amount)),
        const Divider(height: 22),
        if (invoice.discountAmount > 0) ...[
          row('Subtotal', tzs(invoice.subtotal)),
          row('Discount${invoice.discountReason?.isNotEmpty == true ? ' (${invoice.discountReason})' : ''}', '- ${tzs(invoice.discountAmount)}', color: AppColors.accentEmerald),
        ],
        row('Total', tzs(invoice.totalAmount), bold: true),
        row('Paid', tzs(invoice.paidAmount), color: AppColors.accentEmerald),
        row('Outstanding', tzs(invoice.isCancelled || invoice.isWaived ? 0 : invoice.outstandingAmount), color: invoiceColor(invoice), bold: true),
      ]),
    );
  }
}

/// The payments recorded against an invoice, including ones the school has not confirmed yet.
class InvoicePaymentsList extends StatelessWidget {
  const InvoicePaymentsList({super.key, required this.invoice, required this.card, required this.onReceipt});
  final InvoiceModel invoice;
  final FinanceCard card;
  final void Function(String receiptId) onReceipt;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final shown = invoice.payments.where((p) => p.status != 'REJECTED').toList()..sort((a, b) => b.date.compareTo(a.date));
    return card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Payments', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        if (shown.isEmpty) Text('No payments have been recorded for this invoice yet.', style: text.bodySmall),
        for (final p in shown)
          InkWell(
            onTap: p.isConfirmed && p.receiptId != null ? () => onReceipt(p.receiptId!) : null,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Icon(
                  p.isConfirmed ? Icons.check_circle_rounded : p.status == 'REFUNDED' ? Icons.undo_rounded : Icons.hourglass_top_rounded,
                  color: p.isConfirmed ? AppColors.accentEmerald : p.status == 'REFUNDED' ? AppColors.textMuted : AppColors.accentAmber,
                  size: 22,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${tzs(p.amount)} · ${_methodLabel(p.method)}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    Text(
                      p.isPending
                          ? 'Recorded ${financeDate(p.date)} · waiting for the school to confirm'
                          : p.status == 'REFUNDED'
                              ? 'Refunded · ${financeDate(p.date)}'
                              : financeDate(p.date),
                      style: text.bodySmall,
                    ),
                  ]),
                ),
                if (p.isConfirmed && p.receiptId != null) const Icon(Icons.chevron_right_rounded),
              ]),
            ),
          ),
      ]),
    );
  }
}

String _methodLabel(String method) => switch (method) {
      'CASH' => 'Cash',
      'BANK_TRANSFER' => 'Bank transfer',
      'MOBILE_MONEY' => 'Mobile money',
      'CARD' => 'Card',
      _ => method.isEmpty ? 'Payment' : method.replaceAll('_', ' ').toLowerCase(),
    };

/// Plain instructions built from real data: the student's own registration number and what is owed.
class HowToPayCard extends StatelessWidget {
  const HowToPayCard({super.key, required this.invoice, required this.card, this.onContact});
  final InvoiceModel invoice;
  final FinanceCard card;
  final VoidCallback? onContact;

  @override
  Widget build(BuildContext context) {
    if (!invoice.isOpen) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    final reference = invoice.registrationNumber.isNotEmpty ? invoice.registrationNumber : invoice.invoiceNumber;
    Widget step(String line) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.check_circle_rounded, size: 18, color: AppColors.skyBlue600),
            const SizedBox(width: 8),
            Expanded(child: Text(line)),
          ]),
        );
    return card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('How to pay', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        if (reference.isNotEmpty) step('Use "$reference" as the payment reference so the school can match your payment.'),
        step('Pay ${tzs(invoice.outstandingAmount)}, or a smaller amount: part payments are recorded against this invoice.'),
        step('Ask the school finance office for the bank and mobile-money details. Payments appear here once the school confirms them.'),
        if (onContact != null) TextButton.icon(onPressed: onContact, icon: const Icon(Icons.phone_rounded, size: 18), label: const Text('Contact the school')),
      ]),
    );
  }
}

/// A confirmed payment (a receipt) in a list.
class ReceiptRow extends StatelessWidget {
  const ReceiptRow({super.key, required this.receipt, required this.card, required this.onTap, this.studentLabel});
  final ReceiptModel receipt;
  final FinanceCard card;
  final VoidCallback onTap;
  final String? studentLabel;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: card(
        onTap: onTap,
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: AppColors.accentEmerald.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
            child: Icon(_icon(receipt.method), color: AppColors.accentEmerald, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tzs(receipt.amount), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w900, color: AppColors.accentEmerald)),
              Text(
                [receipt.methodLabel, financeDate(receipt.date), if (studentLabel != null && studentLabel!.isNotEmpty) studentLabel!].join(' · '),
                style: text.bodySmall,
              ),
              if (receipt.receiptNumber.isNotEmpty) Text(receipt.receiptNumber, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            ]),
          ),
          const Icon(Icons.chevron_right_rounded),
        ]),
      ),
    );
  }

  static IconData _icon(String method) => switch (method) {
        'MOBILE_MONEY' => Icons.phone_android_rounded,
        'BANK_TRANSFER' => Icons.account_balance_rounded,
        'CASH' => Icons.payments_rounded,
        _ => Icons.credit_card_rounded,
      };
}

/// Download-and-open button for invoice and receipt PDFs, with plain-language failures.
class PdfButton extends ConsumerStatefulWidget {
  const PdfButton({super.key, required this.path, required this.fileName, this.label = 'Download PDF'});
  final String path;
  final String fileName;
  final String label;

  @override
  ConsumerState<PdfButton> createState() => _PdfButtonState();
}

class _PdfButtonState extends ConsumerState<PdfButton> {
  bool _busy = false;

  Future<void> _open() async {
    setState(() => _busy = true);
    try {
      await ref.read(financeDocumentsProvider).open(widget.path, widget.fileName);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiFailure.from(e).message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: _busy ? null : _open,
        icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.picture_as_pdf_rounded, size: 18),
        label: Text(_busy ? 'Preparing…' : widget.label),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
      );
}

/// The receipt itself: proof of one payment.
class ReceiptBody extends StatelessWidget {
  const ReceiptBody({super.key, required this.receipt, required this.card});
  final ReceiptModel receipt;
  final FinanceCard card;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget row(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 120, child: Text(label, style: text.bodySmall)),
            Expanded(child: Text(value, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700))),
          ]),
        );
    return Column(children: [
      if (receipt.isVoided)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: card(
            child: Row(children: [
              const Icon(Icons.block_rounded, color: AppColors.accentRose),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'This receipt was voided${receipt.voidReason?.isNotEmpty == true ? ': ${receipt.voidReason}' : '.'} It no longer counts as proof of payment.',
                  style: text.bodyMedium?.copyWith(color: AppColors.accentRose, fontWeight: FontWeight.w700),
                ),
              ),
            ]),
          ),
        ),
      card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(
            child: Column(children: [
              Icon(receipt.isVoided ? Icons.block_rounded : Icons.check_circle_rounded, size: 44, color: receipt.isVoided ? AppColors.accentRose : AppColors.accentEmerald),
              const SizedBox(height: 8),
              Text(tzs(receipt.amount), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w900, decoration: receipt.isVoided ? TextDecoration.lineThrough : null)),
              Text(receipt.isVoided ? 'Voided payment' : 'Payment received', style: text.bodySmall),
            ]),
          ),
          const Divider(height: 28),
          if (receipt.receiptNumber.isNotEmpty) row('Receipt no.', receipt.receiptNumber),
          if (receipt.studentName.isNotEmpty) row('Student', receipt.studentName),
          if (receipt.termName.isNotEmpty) row('For', receipt.termName),
          row('Date', financeDate(receipt.date)),
          row('Method', receipt.methodLabel),
          if (receipt.reference.isNotEmpty) row('Reference', receipt.reference),
        ]),
      ),
    ]);
  }
}
