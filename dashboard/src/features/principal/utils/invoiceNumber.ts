/** Invoice numbers carry a long internal code in the middle: show the readable ends, keep the full number on hover. */
export function shortInvoice(number: string): string {
  const parts = number.split('-');
  const hex = parts.findIndex((p) => /^[0-9A-F]{16,}$/i.test(p));
  if (hex > 0 && hex < parts.length - 1) return `${parts.slice(0, hex).join('-')}-…${parts[parts.length - 1]}`;
  return number;
}
