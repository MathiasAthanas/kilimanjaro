import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/core/services/api/api_principal_service.dart';
import 'package:kilimanjaro/models/invoice_model.dart';
import 'package:kilimanjaro/models/receipt_model.dart';

Map<String, dynamic> _invoice({String status = 'PARTIALLY_PAID', Object? outstanding = '300', String due = '2099-01-01T00:00:00Z'}) => {
      'id': 'inv-1',
      'invoiceNumber': 'INV-2026-0001',
      'studentName': 'Neema Lema',
      'registrationNumber': 'KS-S-2026-00012',
      'className': 'Form 3',
      'termName': 'Term 2',
      'academicYearName': '2026 Academic Year',
      'totalAmount': '1000.00',
      'paidAmount': '700',
      'outstandingBalance': outstanding,
      'status': status,
      'dueDate': due,
      'lineItems': [
        {'feeCategoryName': 'Tuition', 'amount': '900'},
        {'feeCategoryName': 'Exam', 'amount': 100},
      ],
      'payments': [
        {'id': 'p1', 'amount': '700', 'method': 'CASH', 'status': 'CONFIRMED', 'paidAt': '2026-05-20T10:00:00Z'},
        {'id': 'p2', 'amount': 50, 'method': 'BANK_TRANSFER', 'status': 'PENDING', 'createdAt': '2026-05-21T10:00:00Z'},
      ],
    };

void main() {
  group('InvoiceModel', () {
    test('reads the finance service payload, including decimals sent as strings', () {
      final inv = InvoiceModel.fromJson(_invoice());
      expect(inv.totalAmount, 1000);
      expect(inv.outstandingAmount, 300);
      expect(inv.items.map((i) => i.label), ['Tuition', 'Exam']);
      expect(inv.items.last.amount, 100);
      expect(inv.progress, closeTo(0.7, 1e-9));
      expect(inv.statusLabel, 'Part paid');
      expect(inv.heading, 'Term 2 · 2026 Academic Year');
      expect(inv.payments.where((p) => p.isConfirmed), hasLength(1));
      expect(inv.payments.where((p) => p.isPending), hasLength(1));
    });

    test('cancelled and waived invoices are never owed', () {
      final cancelled = InvoiceModel.fromJson(_invoice(status: 'CANCELLED'));
      final waived = InvoiceModel.fromJson(_invoice(status: 'WAIVED'));
      expect(cancelled.isOpen, isFalse);
      expect(waived.isOpen, isFalse);
      expect(cancelled.isOverdue, isFalse);
    });

    test('an unpaid invoice past its due date is overdue', () {
      final inv = InvoiceModel.fromJson(_invoice(status: 'ISSUED', due: '2020-01-01T00:00:00Z'));
      expect(inv.isOpen, isTrue);
      expect(inv.isOverdue, isTrue);
      expect(inv.statusLabel, 'Unpaid');
    });

    test('a settled invoice is not open', () {
      final inv = InvoiceModel.fromJson(_invoice(status: 'PAID', outstanding: '0'));
      expect(inv.isSettled, isTrue);
      expect(inv.isOpen, isFalse);
    });

    test('currentInvoiceOf prefers the open invoice due soonest, then the latest non-cancelled one', () {
      final later = InvoiceModel.fromJson({..._invoice(), 'id': 'later', 'dueDate': '2099-06-01T00:00:00Z'});
      final sooner = InvoiceModel.fromJson({..._invoice(), 'id': 'sooner', 'dueDate': '2099-02-01T00:00:00Z'});
      final paid = InvoiceModel.fromJson({..._invoice(status: 'PAID', outstanding: '0'), 'id': 'paid'});
      expect(currentInvoiceOf([later, sooner, paid])?.id, 'sooner');
      expect(currentInvoiceOf([paid])?.id, 'paid');
      expect(currentInvoiceOf([InvoiceModel.fromJson(_invoice(status: 'CANCELLED'))]), isNull);
      expect(currentInvoiceOf(const []), isNull);
    });

    test('missing fields fall back to safe defaults instead of throwing', () {
      final inv = InvoiceModel.fromJson(const {'id': 'x'});
      expect(inv.totalAmount, 0);
      expect(inv.items, isEmpty);
      expect(inv.progress, 0);
      expect(inv.status, 'DRAFT');
    });
  });

  group('ReceiptModel', () {
    test('reads number, student and void state', () {
      final r = ReceiptModel.fromJson({
        'id': 'r1',
        'invoiceId': 'inv-1',
        'amount': '250000.00',
        'method': 'BANK_TRANSFER',
        'receiptNumber': 'RCT-2026-0001',
        'studentName': 'Neema Lema',
        'issuedAt': '2026-05-20T10:00:00Z',
        'isVoided': true,
        'voidReason': 'Payment refunded',
      });
      expect(r.amount, 250000);
      expect(r.methodLabel, 'Bank transfer');
      expect(r.studentName, 'Neema Lema');
      expect(r.isVoided, isTrue);
    });

    test('never shows the issuer id as the student name', () {
      final r = ReceiptModel.fromJson({'id': 'r1', 'issuedById': 'a1b2c3d4-uuid'});
      expect(r.studentName, '');
    });
  });

  group('PrincipalPayment', () {
    test('flattens the approval record and its nested payment', () {
      final p = PrincipalPayment.fromJson({
        'id': 'approval-1',
        'requestedAt': '2026-10-24T08:00:00Z',
        'studentName': 'Salma Tarimo',
        'registrationNumber': 'KS-A-2026-00216',
        'invoiceNumber': 'INV-2026-00216',
        'payment': {'amount': '100000.00', 'method': 'CASH', 'paymentNumber': 'PAY-KS-SEC-2026-00000001', 'notes': 'Cash drawer 2'},
      });
      expect(p.approvalId, 'approval-1');
      expect(p.amount, 100000);
      expect(p.studentName, 'Salma Tarimo');
      expect(p.invoiceNumber, 'INV-2026-00216');
      expect(p.paymentNumber, 'PAY-KS-SEC-2026-00000001');
      expect(p.notes, 'Cash drawer 2');
      expect(p.requestedAt, isNotNull);
    });
  });
}
