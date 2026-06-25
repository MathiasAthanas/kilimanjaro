class PaymentModel {
  const PaymentModel({
    required this.id,
    required this.amount,
    required this.method,
    required this.date,
    required this.invoiceId,
  });

  final String id;
  final double amount;
  final String method;
  final DateTime date;
  final String invoiceId;

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    final paidAt = json['paidAt'] as String? ?? json['confirmedAt'] as String? ?? json['createdAt'] as String?;
    return PaymentModel(
      id: json['id'] as String? ?? '',
      amount: double.tryParse((json['amount'] ?? '0').toString()) ?? 0.0,
      method: json['method'] as String? ?? '',
      date: paidAt != null ? DateTime.parse(paidAt) : DateTime.now(),
      invoiceId: json['invoiceId'] as String? ?? '',
    );
  }
}
