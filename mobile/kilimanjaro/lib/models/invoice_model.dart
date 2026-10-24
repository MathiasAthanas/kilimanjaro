double _money(Object? v) => double.tryParse((v ?? '0').toString()) ?? 0.0;

class InvoiceLineItem {
  const InvoiceLineItem({required this.label, required this.amount});

  final String label;
  final double amount;

  factory InvoiceLineItem.fromJson(Map<String, dynamic> json) => InvoiceLineItem(
        label: json['feeCategoryName'] as String? ?? json['label'] as String? ?? '',
        amount: _money(json['amount']),
      );
}

/// A payment recorded against an invoice, as shown in the invoice's own history.
class InvoicePayment {
  const InvoicePayment({
    required this.id,
    required this.amount,
    required this.method,
    required this.status,
    required this.date,
    this.reference,
    this.receiptId,
  });

  final String id;
  final double amount;
  final String method;

  /// PENDING (awaiting approval), CONFIRMED, REJECTED or REFUNDED.
  final String status;
  final DateTime date;
  final String? reference;
  final String? receiptId;

  bool get isConfirmed => status == 'CONFIRMED';
  bool get isPending => status == 'PENDING';

  factory InvoicePayment.fromJson(Map<String, dynamic> json) {
    final at = json['paidAt'] as String? ?? json['createdAt'] as String?;
    return InvoicePayment(
      id: json['id'] as String? ?? '',
      amount: _money(json['amount']),
      method: json['method'] as String? ?? '',
      status: json['status'] as String? ?? '',
      date: DateTime.tryParse(at ?? '')?.toLocal() ?? DateTime.now(),
      reference: json['referenceNumber'] as String?,
      receiptId: json['receiptId'] as String?,
    );
  }
}

class InvoiceModel {
  const InvoiceModel({
    required this.id,
    required this.title,
    required this.issueDate,
    required this.dueDate,
    required this.totalAmount,
    required this.paidAmount,
    required this.outstandingAmount,
    required this.status,
    required this.items,
    this.invoiceNumber = '',
    this.studentId = '',
    this.studentName = '',
    this.registrationNumber = '',
    this.className = '',
    this.termName = '',
    this.academicYearName = '',
    this.subtotal = 0,
    this.discountAmount = 0,
    this.discountReason,
    this.payments = const [],
  });

  final String id;
  final String title;
  final DateTime issueDate;
  final DateTime dueDate;
  final double totalAmount;
  final double paidAmount;
  final double outstandingAmount;
  final String status;
  final List<InvoiceLineItem> items;
  final String invoiceNumber;
  final String studentId;
  final String studentName;
  final String registrationNumber;
  final String className;
  final String termName;
  final String academicYearName;
  final double subtotal;
  final double discountAmount;
  final String? discountReason;
  final List<InvoicePayment> payments;

  double get progress => totalAmount <= 0 ? 0 : (paidAmount / totalAmount).clamp(0, 1).toDouble();

  /// Cancelled and waived invoices are never owed.
  bool get isCancelled => status == 'CANCELLED';
  bool get isWaived => status == 'WAIVED';
  bool get isSettled => status == 'PAID' || outstandingAmount <= 0;
  bool get isOpen => !isCancelled && !isWaived && outstandingAmount > 0;
  bool get isOverdue => status == 'OVERDUE' || (isOpen && dueDate.isBefore(DateTime.now()));

  /// "Term 2 · 2026 Academic Year" when known, otherwise the invoice number.
  String get heading {
    final parts = [termName, academicYearName].where((p) => p.isNotEmpty);
    return parts.isEmpty ? (invoiceNumber.isNotEmpty ? invoiceNumber : title) : parts.join(' · ');
  }

  String get statusLabel => switch (status) {
        'PAID' => 'Paid',
        'PARTIALLY_PAID' => 'Part paid',
        'OVERDUE' => 'Overdue',
        'CANCELLED' => 'Cancelled',
        'WAIVED' => 'Waived',
        'ISSUED' => 'Unpaid',
        'DRAFT' => 'Draft',
        _ => status,
      };

  factory InvoiceModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['lineItems'] as List<dynamic>? ?? json['items'] as List<dynamic>? ?? [];
    final rawPayments = json['payments'] as List<dynamic>? ?? [];
    final issuedAt = json['issuedAt'] as String? ?? json['issueDate'] as String?;
    final total = _money(json['totalAmount']);
    return InvoiceModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? json['invoiceNumber'] as String? ?? 'Invoice',
      issueDate: DateTime.tryParse(issuedAt ?? '')?.toLocal() ?? DateTime.now(),
      dueDate: DateTime.tryParse(json['dueDate'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      totalAmount: total,
      paidAmount: _money(json['paidAmount']),
      outstandingAmount: _money(json['outstandingBalance'] ?? json['outstandingAmount']),
      status: json['status'] as String? ?? 'DRAFT',
      items: rawItems.whereType<Map>().map((i) => InvoiceLineItem.fromJson(Map<String, dynamic>.from(i))).toList(),
      invoiceNumber: json['invoiceNumber'] as String? ?? '',
      studentId: json['studentId'] as String? ?? '',
      studentName: json['studentName'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? '',
      className: json['className'] as String? ?? '',
      termName: json['termName'] as String? ?? '',
      academicYearName: json['academicYearName'] as String? ?? '',
      subtotal: json['subtotal'] == null ? total : _money(json['subtotal']),
      discountAmount: _money(json['discountAmount']),
      discountReason: json['discountReason'] as String?,
      payments: rawPayments.whereType<Map>().map((p) => InvoicePayment.fromJson(Map<String, dynamic>.from(p))).toList(),
    );
  }
}

/// The invoice a family should look at first: the open one due soonest, else the latest one that was not cancelled.
InvoiceModel? currentInvoiceOf(List<InvoiceModel> invoices) {
  final open = invoices.where((i) => i.isOpen).toList()..sort((a, b) => a.dueDate.compareTo(b.dueDate));
  if (open.isNotEmpty) return open.first;
  final rest = invoices.where((i) => !i.isCancelled).toList()..sort((a, b) => b.issueDate.compareTo(a.issueDate));
  return rest.isEmpty ? null : rest.first;
}
