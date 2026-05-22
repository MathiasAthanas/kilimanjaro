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
}
