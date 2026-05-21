export function KilimanjaroMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <img
      src="/kilimanjaro_logo.png"
      alt="Kilimanjaro Schools"
      className={`${className} rounded-full object-contain`}
    />
  );
}
