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

  factory ReceiptModel.fromJson(Map<String, dynamic> json) {
    return ReceiptModel(
      id: json['id'] as String? ?? '',
      invoiceId: json['invoiceId'] as String? ?? '',
      amount: double.tryParse((json['amount'] ?? '0').toString()) ?? 0.0,
      method: json['method'] as String? ?? '',
      reference: json['referenceNumber'] as String? ?? json['reference'] as String? ?? '',
      date: DateTime.parse(json['paidAt'] as String? ?? json['issuedAt'] as String? ?? DateTime.now().toIso8601String()),
      issuedBy: json['studentName'] as String? ?? json['issuedById'] as String? ?? '',
    );
  }
}
