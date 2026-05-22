class ReceiptModel {
  const ReceiptModel({
    required this.id,
    required this.invoiceId,
    required this.amount,
    required this.method,
    required this.reference,
    required this.date,
    required this.issuedBy,
  });

  final String id;
  final String invoiceId;
  final double amount;
  final String method;
  final String reference;
  final DateTime date;
  final String issuedBy;
}
