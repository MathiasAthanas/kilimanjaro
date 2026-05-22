class InvoiceLineItem {
  const InvoiceLineItem({
    required this.label,
    required this.amount,
    required this.status,
  });

  final String label;
  final double amount;
  final String status;
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
}
