type StatPillProps = {
  label: string;
  value: string;
};

export function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="surface-card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-brand-navy">{value}</p>
    </div>
  );
}
