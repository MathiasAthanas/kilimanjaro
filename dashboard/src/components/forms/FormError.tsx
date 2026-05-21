export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-semibold text-ks-rose">{message}</p>;
}
