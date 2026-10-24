/// Reads a JSON number that the backend may send as a number or, for Prisma
/// Decimal columns, as a numeric string ("85.50").
num? numOf(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}
