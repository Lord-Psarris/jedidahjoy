type ModuleCardProps = {
  number: string;
  title: string;
  description: string;
};

export function ModuleCard({ number, title, description }: ModuleCardProps) {
  return (
    <article className="surface-card h-full p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="rounded-full bg-brand-sky px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy">
          Module {number}
        </span>
        <span className="h-11 w-11 rounded-2xl bg-brand-blush/70" />
      </div>
      <h3 className="mt-6 font-display text-3xl text-brand-navy">{title}</h3>
      <p className="mt-4 text-base leading-8 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
