class InvoiceLineItem {
  const InvoiceLineItem({
    required this.label,
    required this.amount,
    required this.status,
  });

  final String label;
  final double amount;
  final String status;

  factory InvoiceLineItem.fromJson(Map<String, dynamic> json) {
    return InvoiceLineItem(
      label: json['feeCategoryName'] as String? ?? json['label'] as String? ?? '',
      amount: double.tryParse((json['amount'] ?? '0').toString()) ?? 0.0,
      status: (json['isPaid'] as bool? ?? false) ? 'PAID' : 'PENDING',
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

  double get progress => totalAmount == 0 ? 0 : paidAmount / totalAmount;

  factory InvoiceModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['lineItems'] as List<dynamic>? ?? json['items'] as List<dynamic>? ?? [];
    final issuedAt = json['issuedAt'] as String? ?? json['issueDate'] as String?;
    return InvoiceModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? json['invoiceNumber'] as String? ?? 'Invoice',
      issueDate: issuedAt != null ? DateTime.parse(issuedAt) : DateTime.now(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      totalAmount: double.tryParse((json['totalAmount'] ?? '0').toString()) ?? 0.0,
      paidAmount: double.tryParse((json['paidAmount'] ?? '0').toString()) ?? 0.0,
      outstandingAmount: double.tryParse((json['outstandingBalance'] ?? json['outstandingAmount'] ?? '0').toString()) ?? 0.0,
      status: json['status'] as String? ?? 'DRAFT',
      items: rawItems
          .map((i) => InvoiceLineItem.fromJson(i as Map<String, dynamic>))
          .toList(),
    );
  }
}
