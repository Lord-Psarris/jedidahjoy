import { ArrowRightIcon, PhoneIcon } from "@/components/landing/icons";

type CtaButtonsProps = {
  primaryHref: string;
  secondaryHref: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  className?: string;
};

export function CtaButtons({
  primaryHref,
  secondaryHref,
  primaryLabel = "Buy Now",
  secondaryLabel = "Contact Us",
  className = "",
}: CtaButtonsProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`.trim()}>
      <a
        href={primaryHref}
        className="btn-primary"
        target="_blank"
        rel="noreferrer"
      >
        {primaryLabel}
        <ArrowRightIcon className="h-4 w-4" />
      </a>
      <a href={secondaryHref} className="btn-secondary">
        <PhoneIcon className="h-4 w-4" />
        {secondaryLabel}
      </a>
    </div>
  );
}
