export const EXPENSE_CATEGORY_OPTIONS = [
  'SALARY',
  'UTILITIES',
  'MAINTENANCE',
  'SUPPLIES',
  'TRANSPORT',
  'FOOD',
  'ACADEMIC',
  'ADMINISTRATIVE',
  'EXAMINATION',
  'SPORTS',
  'FUND_DISBURSEMENT',
  'OTHER',
] as const;

export const STORE_CATEGORY_OPTIONS = [
  'FOOD',
  'STATIONERY',
  'CLEANING',
  'MAINTENANCE',
  'MEDICAL',
  'UNIFORM',
  'LABORATORY',
  'SPORTS',
  'OTHER',
] as const;

export const PAYMENT_METHOD_OPTIONS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER'] as const;

export const STORE_UNIT_OPTIONS = [
  'kg', 'g', 'litre', 'ml',
  'piece', 'unit', 'set', 'pair',
  'box', 'carton', 'crate', 'pack',
  'bag', 'sack', 'tin', 'bottle',
  'roll', 'sheet', 'ream',
  'dozen', 'gross',
  'metre', 'cm',
] as const;
