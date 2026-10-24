class ReceiptModel {
  const ReceiptModel({
    required this.id,
    required this.invoiceId,
    required this.amount,
    required this.method,
    required this.reference,
    required this.date,
    required this.issuedBy,
    this.receiptNumber = '',
    this.studentId = '',
    this.termName = '',
    this.isVoided = false,
    this.voidReason,
  });

  final String id;
  final String invoiceId;
  final double amount;
  final String method;
  final String reference;
  final DateTime date;

  /// The student the receipt is for (kept under its old name so existing screens keep working).
  final String issuedBy;
  final String receiptNumber;
  final String studentId;
  final String termName;

  /// A voided receipt (refund or correction) no longer counts as proof of payment.
  final bool isVoided;
  final String? voidReason;

  String get studentName => issuedBy;

  String get methodLabel => switch (method) {
        'CASH' => 'Cash',
        'BANK_TRANSFER' => 'Bank transfer',
        'MOBILE_MONEY' => 'Mobile money',
        'CARD' => 'Card',
        _ => method.isEmpty ? 'Payment' : method.replaceAll('_', ' ').toLowerCase(),
      };

  factory ReceiptModel.fromJson(Map<String, dynamic> json) {
    return ReceiptModel(
      id: json['id'] as String? ?? '',
      invoiceId: json['invoiceId'] as String? ?? '',
      amount: double.tryParse((json['amount'] ?? '0').toString()) ?? 0.0,
      method: json['method'] as String? ?? '',
      reference: json['referenceNumber'] as String? ?? json['reference'] as String? ?? '',
      date: DateTime.tryParse(json['paidAt'] as String? ?? json['issuedAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      issuedBy: json['studentName'] as String? ?? '',
      receiptNumber: json['receiptNumber'] as String? ?? '',
      studentId: json['studentId'] as String? ?? '',
      termName: json['termName'] as String? ?? '',
      isVoided: json['isVoided'] as bool? ?? false,
      voidReason: json['voidReason'] as String?,
    );
  }
}
