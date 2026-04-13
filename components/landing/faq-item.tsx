import { PlusIcon } from "@/components/landing/icons";

type FaqItemProps = {
  question: string;
  answer: string;
};

export function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group surface-card px-6 py-5">
      <summary className="flex cursor-pointer items-start justify-between gap-4">
        <span className="text-left text-lg font-semibold text-brand-navy">
          {question}
        </span>
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-sky/75 text-brand-navy transition-transform duration-200 group-open:rotate-45">
          <PlusIcon className="h-4 w-4" />
        </span>
      </summary>
      <p className="pt-4 text-base leading-8 text-muted-foreground">{answer}</p>
    </details>
  );
}
