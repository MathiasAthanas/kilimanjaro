export function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-ks-line bg-ks-paper px-1.5 py-0.5 text-[10px] font-black text-ks-muted">{children}</kbd>;
}
