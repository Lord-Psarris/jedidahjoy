type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  widthClassName?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  widthClassName = "max-w-3xl",
}: SectionHeadingProps) {
  const isCentered = align === "center";

  return (
    <div
      className={`${isCentered ? "mx-auto text-center" : ""} ${widthClassName}`.trim()}
    >
      <span className={`section-kicker ${isCentered ? "mx-auto" : ""}`.trim()}>
        {eyebrow}
      </span>
      <h2 className="mt-5 font-display text-4xl leading-tight text-brand-navy sm:text-5xl">
        {title}
      </h2>
      <p className={`section-copy mt-5 ${isCentered ? "mx-auto" : ""}`.trim()}>
        {description}
      </p>
    </div>
  );
}
