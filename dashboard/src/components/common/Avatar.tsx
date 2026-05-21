export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ks-mist bg-ks-navy text-xs font-black text-white">
      {initials}
    </div>
  );
}
