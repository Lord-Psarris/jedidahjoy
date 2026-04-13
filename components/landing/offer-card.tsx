import { CtaButtons } from "@/components/landing/cta-buttons";
import { CheckIcon } from "@/components/landing/icons";

type OfferCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  originalPrice: string;
  promoPrice: string;
  primaryHref: string;
  secondaryHref: string;
  secondaryLabel?: string;
};

export function OfferCard({
  eyebrow,
  title,
  description,
  highlights,
  originalPrice,
  promoPrice,
  primaryHref,
  secondaryHref,
  secondaryLabel,
}: OfferCardProps) {
  return (
    <aside className="surface-card overflow-hidden p-7 sm:p-8">
      <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(217,235,246,0.68),rgba(255,255,255,0.98)_58%,rgba(245,216,223,0.78))] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
          {eyebrow}
        </p>
        <h3 className="mt-4 font-display text-4xl leading-tight text-brand-navy">
          {title}
        </h3>
        <p className="mt-4 text-base leading-8 text-muted-foreground">
          {description}
        </p>

        <div className="mt-6 rounded-[1.4rem] bg-white/86 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
            Current fee
          </p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-2xl font-semibold text-muted-foreground/75 line-through">
              {originalPrice}
            </span>
            <span className="font-display text-5xl text-brand-coral">
              {promoPrice}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Includes your free e-book bonus.
          </p>
        </div>

        <ul className="mt-6 grid gap-3">
          {highlights.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-[1.2rem] bg-white/68 px-4 py-3 text-sm font-medium text-brand-navy"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-sky/75 text-brand-navy">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-brand-navy px-5 py-4 text-sm font-medium text-white/85">
        The promo fee is designed to help you start now. Learn step by step and
        build from there.
      </div>

      <CtaButtons
        primaryHref={primaryHref}
        secondaryHref={secondaryHref}
        secondaryLabel={secondaryLabel}
        className="mt-6"
      />
    </aside>
  );
}
