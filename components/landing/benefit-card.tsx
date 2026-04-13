import type { ComponentType } from "react";

type BenefitCardProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

export function BenefitCard({
  icon: Icon,
  title,
  description,
}: BenefitCardProps) {
  return (
    <article className="surface-card h-full p-6 sm:p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sky/75 text-brand-navy">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-2xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-4 text-base leading-8 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
