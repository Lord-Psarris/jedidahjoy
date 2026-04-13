import type { Metadata } from "next";
import Image from "next/image";
import { BenefitCard } from "@/components/landing/benefit-card";
import { CtaButtons } from "@/components/landing/cta-buttons";
import { FaqItem } from "@/components/landing/faq-item";
import {
  BottleIcon,
  BriefcaseIcon,
  CheckIcon,
  CoinStackIcon,
  HomeIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/landing/icons";
import { ModuleCard } from "@/components/landing/module-card";
import { OfferCard } from "@/components/landing/offer-card";
import { SectionHeading } from "@/components/landing/section-heading";
import { StatPill } from "@/components/landing/stat-pill";

const primaryHeadline =
  "Become a Pro in Soap Making and Learn Products You Can Start Selling From Home.";
const brandName = "Learn with Joy Essentials";
const brandShortName = "Joy Essentials";
const heroDescription =
  "Join Jedidiah Joy for practical, beginner-friendly training that shows you how to produce household products people use every day, package them well, and turn the skill into income.";
// Replace with the real checkout URL when the payment link is ready.
const paymentHref = "https://example.com/replace-with-payment-link";
const phoneHref = "tel:08148293945";
const portraitSrc = "/joy-portrait.jpeg";
const pricing = {
  original: "\u20A620,000",
  promo: "\u20A615,000",
} as const;

const heroStats = [
  { label: "Students trained", value: "1,000+" },
  { label: "Learning style", value: "Beginner friendly" },
  { label: "Bonus included", value: "Free e-book" },
] as const;

const trustStrip = [
  { label: "Practical modules", value: "7" },
  { label: "Promo fee today", value: pricing.promo },
  { label: "Delivery style", value: "Online" },
  { label: "Business angle", value: "Brand & marketing" },
] as const;

const benefits = [
  {
    icon: CoinStackIcon,
    title: "Learn a profitable household product skill",
    description:
      "Build a skill around products people already buy, so your effort is tied to real everyday demand.",
  },
  {
    icon: BriefcaseIcon,
    title: "Start a side hustle with practical steps",
    description:
      "Move from interest to action with a training style that helps you start small and grow with confidence.",
  },
  {
    icon: HomeIcon,
    title: "Build your brand from home",
    description:
      "Use what you learn to produce, package, and present your products professionally without needing a large setup.",
  },
  {
    icon: SparklesIcon,
    title: "Grow with self-reliant, income-ready knowledge",
    description:
      "Gain a skill you can use for personal production, customer orders, or a simple product-based business.",
  },
] as const;

const modules = [
  {
    number: "01",
    title: "Air freshener",
    description:
      "Learn to create fresh, pleasant scents you can confidently package for home or customer use.",
  },
  {
    number: "02",
    title: "Liquid soap",
    description:
      "Produce a reliable cleaning product with a practical method that is easy to repeat and improve.",
  },
  {
    number: "03",
    title: "Toilet wash",
    description:
      "Make a useful household cleaning solution that fits directly into a profitable product line.",
  },
  {
    number: "04",
    title: "Oil perfume",
    description:
      "Add a premium-feeling product to your offer with a formula designed for everyday appeal.",
  },
  {
    number: "05",
    title: "Transparent liquid soap",
    description:
      "Master a high-quality version that helps your brand look polished, clean, and more market-ready.",
  },
  {
    number: "06",
    title: "Hot water liquid soap",
    description:
      "Understand another practical production method so you can choose what works best for your process.",
  },
  {
    number: "07",
    title: "Packaging and marketing",
    description:
      "Learn how to present your products, position your brand, and speak to buyers with more clarity.",
  },
] as const;

const audience = [
  "Beginners who want to learn a valuable skill step by step.",
  "People who want to start a small business with a practical product offer.",
  "Students, stay-at-home individuals, and working professionals looking for extra income.",
  "Aspiring entrepreneurs who want to learn production knowledge they can actually use.",
] as const;

const faqs = [
  {
    question: "Is this course beginner-friendly?",
    answer:
      "Yes. The course is designed for beginners who want clear, practical guidance. The lessons are structured to help you start with what you have and build your confidence as you learn.",
  },
  {
    question: "Will I learn how to sell these products too?",
    answer:
      "Yes. Beyond production, the course also covers packaging and marketing so you can present your products better and build a brand people can trust.",
  },
  {
    question: "Is this course online?",
    answer:
      "Yes. This is an online course, making it easier for you to learn from your location and follow the training at your own pace.",
  },
  {
    question: "Will I get access to all the listed modules?",
    answer:
      "Yes. Your registration covers all the listed modules, including air freshener, multiple liquid soap methods, toilet wash, oil perfume, and packaging and marketing.",
  },
  {
    question: "How do I buy the course?",
    answer:
      "Click any Buy Now button on the page to continue through the payment link. If you prefer to speak to the team first, you can also call 08148293945 directly.",
  },
] as const;

export const metadata: Metadata = {
  title: "Become a Pro in Soap Making",
  description:
    "Practical soap-making and household product training by Jedidiah Joy. Learn profitable products, packaging, marketing, and business-ready skills for \u20A615,000.",
};

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_38%),radial-gradient(circle_at_75%_10%,rgba(235,119,95,0.08),transparent_22%)]"
      />
      <header className="sticky top-0 z-50 border-b soft-divider bg-white/70 backdrop-blur-xl">
        <div className="container-shell flex items-center justify-between py-4">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-sky text-brand-navy">
              <BottleIcon className="h-5 w-5" />
            </span>
            <span className="truncate font-display text-xl text-brand-navy">
              {brandShortName}
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#why-course" className="hover:text-brand-navy">
              Why this course
            </a>
            <a href="#curriculum" className="hover:text-brand-navy">
              What you will learn
            </a>
            <a href="#about" className="hover:text-brand-navy">
              About Joy
            </a>
            <a href="#faq" className="hover:text-brand-navy">
              FAQ
            </a>
          </nav>
          <a
            href={paymentHref}
            className="btn-primary hidden sm:inline-flex"
            target="_blank"
            rel="noreferrer"
          >
            Buy Now
          </a>
        </div>
      </header>

      <main id="top">
        <section className="section-space pb-8 pt-6 sm:pt-10 lg:pb-10">
          <div className="container-shell lg:flex lg:items-center lg:justify-between lg:gap-10 xl:gap-14">
            <div className="order-2 flex flex-col gap-6 lg:order-1 lg:w-[54%] lg:justify-center">
              <div className="flex flex-col gap-4">
                <span className="section-kicker">
                  <StarIcon className="h-4 w-4" />
                  Soap Making Masterclass
                </span>
                <div className="space-y-4">
                  <h1 className="max-w-[17ch] font-display text-5xl leading-[1.03] text-brand-navy sm:text-6xl lg:text-[4.55rem]">
                    {primaryHeadline}
                  </h1>
                  <p className="section-copy max-w-[40rem]">{heroDescription}</p>
                </div>
              </div>

              <div className="surface-card max-w-[44rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
                      Limited promo offer
                    </p>
                    <div className="flex items-end gap-3">
                      <span className="text-2xl font-semibold text-muted-foreground/75 line-through">
                        {pricing.original}
                      </span>
                      <span className="font-display text-5xl text-brand-coral sm:text-6xl">
                        {pricing.promo}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-brand-cream px-5 py-4 text-brand-navy">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/65">
                      Bonus
                    </p>
                    <p className="mt-1 text-lg font-bold">Free e-book included</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-muted-foreground">
                  <span className="rounded-full bg-brand-sky/60 px-4 py-2 text-brand-navy">
                    Start with what you have
                  </span>
                  <span className="rounded-full bg-brand-blush/55 px-4 py-2 text-brand-navy">
                    Learn step by step
                  </span>
                </div>
              </div>

              <CtaButtons
                primaryHref={paymentHref}
                secondaryHref={phoneHref}
                primaryLabel="Buy Now"
                secondaryLabel="Call 08148293945"
                className="max-w-[44rem]"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <StatPill key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </div>

            <div className="order-1 mb-2 lg:order-2 lg:mb-0 lg:w-[42%]">
              <div className="relative mx-auto max-w-[38rem]">
                <div className="absolute -left-8 top-10 hidden h-28 w-28 rounded-full bg-brand-sky blur-3xl sm:block" />
                <div className="absolute -bottom-6 right-8 hidden h-32 w-32 rounded-full bg-brand-blush blur-3xl sm:block" />
                <div className="surface-card relative overflow-hidden rounded-[2rem] p-3 shadow-[0_32px_80px_rgba(25,53,77,0.14)]">
                  <div className="relative aspect-[5/5.2] overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(217,235,246,0.9),rgba(255,255,255,0.6))]">
                    <Image
                      src={portraitSrc}
                      alt={`Jedidiah Joy, instructor at ${brandName}`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 42vw"
                      className="object-cover object-[64%_center]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-brand-navy/28 via-brand-navy/8 to-transparent" />
                  </div>
                  <div className="absolute inset-x-8 bottom-7 rounded-[1.4rem] border border-white/45 bg-white/78 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/60">
                      Instructor spotlight
                    </p>
                    <p className="mt-2 font-display text-2xl text-brand-navy">
                      Jedidiah Joy
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Global skill coach helping people learn practical production
                      skills, build confidence, and grow toward financial
                      independence.
                    </p>
                  </div>
                </div>

                <div className="absolute -left-3 top-8 hidden rounded-[1.4rem] border border-white/40 bg-white/85 p-4 shadow-[0_18px_36px_rgba(25,53,77,0.12)] backdrop-blur sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-navy/55">
                    Trust cue
                  </p>
                  <p className="mt-2 text-lg font-bold text-brand-navy">
                    1,000+ trained
                  </p>
                </div>

                <div className="absolute -bottom-4 right-4 hidden rounded-[1.4rem] border border-white/40 bg-white/85 p-4 shadow-[0_18px_36px_rgba(25,53,77,0.12)] backdrop-blur sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-navy/55">
                    Course fit
                  </p>
                  <p className="mt-2 text-lg font-bold text-brand-navy">
                    Built for beginners
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-6">
          <div className="container-shell">
            <div className="surface-card grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
              {trustStrip.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.3rem] bg-white/70 px-5 py-4 text-center"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-brand-navy">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why-course" className="section-space">
          <div className="container-shell">
            <SectionHeading
              eyebrow="Why this course matters"
              title="Learn a skill that is practical, marketable, and easier to start than you think."
              description="This training is built for people who want more than motivation. It gives you a product skill you can use at home, turn into a side hustle, and grow into a brand over time."
              widthClassName="max-w-4xl"
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {benefits.map((benefit) => (
                <BenefitCard
                  key={benefit.title}
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="curriculum" className="section-space bg-white/55">
          <div className="container-shell">
            <SectionHeading
              eyebrow="What you will learn"
              title="A business-minded course outline that moves from production to presentation."
              description="Each module is designed to help you learn something useful, improve your product quality, and understand how to make the skill work for real life."
              align="center"
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <ModuleCard
                  key={module.number}
                  number={module.number}
                  title={module.title}
                  description={module.description}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="section-space">
          <div className="container-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="surface-card p-7 sm:p-8">
              <span className="section-kicker">
                <SparklesIcon className="h-4 w-4" />
                About the instructor
              </span>
              <h2 className="mt-5 font-display text-4xl text-brand-navy sm:text-5xl">
                A mission-led coach teaching practical entrepreneurship with heart.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Jedidiah Joy is a passionate global skill coach and entrepreneur
                committed to empowering individuals through skill development,
                self-reliance, and purposeful business building.
              </p>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                She studied Business Administration and Management at Federal
                Polytechnic Auchi, founded Christ Foundation Outreach, and also
                built {brandName} as a platform for teaching
                household and homemade product production in a practical way.
              </p>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Through her work online and offline, she has trained over 1,000
                individuals, influenced youths and teens, and remained focused
                on helping more Nigerians pursue financial independence through
                valuable skills.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="surface-card bg-[linear-gradient(180deg,rgba(217,235,246,0.72),rgba(255,255,255,0.88))] p-7 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
                  Her mission
                </p>
                <p className="mt-4 font-display text-3xl leading-tight text-brand-navy sm:text-4xl">
                  To equip everyday people with real skills that can reduce
                  dependence, create income, and open new opportunities.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <StatPill label="Direct trainees" value="1,000+" />
                <StatPill label="Training reach" value="Online & offline" />
                <StatPill label="Core focus" value="Skills + entrepreneurship" />
              </div>
              <div className="surface-card p-7 sm:p-8">
                <div className="flex items-start gap-4">
                  <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blush/70 text-brand-navy">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-brand-navy">
                      Why people trust her teaching
                    </h3>
                    <p className="mt-3 text-base leading-8 text-muted-foreground">
                      Her approach blends practical product knowledge,
                      entrepreneurial thinking, and a genuine desire to see
                      others grow. The result is training that feels both warm
                      and useful, especially for beginners who want direction
                      they can act on.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-space bg-white/55">
          <div className="container-shell">
            <SectionHeading
              eyebrow="Who this is for"
              title="Built for people who want a real skill, not just more information."
              description="If you want to learn something practical, start from home, and build toward income or independence, this course is designed with you in mind."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {audience.map((item) => (
                <div key={item} className="surface-card p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-sky/70 text-brand-navy">
                    <StarIcon className="h-5 w-5" />
                  </span>
                  <p className="mt-5 text-base leading-8 text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="section-space">
          <div className="container-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Pricing and offer"
                title="A low-entry offer for a skill that can keep paying you back."
                description="This promo makes it easier to start now, learn the process properly, and begin building your confidence without waiting for a perfect moment."
              />
              <ul className="mt-8 grid gap-4 text-base leading-8 text-muted-foreground">
                <li className="surface-card flex items-start gap-4 p-5">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-sky/70 text-brand-navy">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span>Access all listed product modules in one course.</span>
                </li>
                <li className="surface-card flex items-start gap-4 p-5">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blush/70 text-brand-navy">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span>Learn how to package and market your products better.</span>
                </li>
                <li className="surface-card flex items-start gap-4 p-5">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-cream text-brand-navy">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span>Receive a free e-book bonus at the promo fee.</span>
                </li>
              </ul>
            </div>

            <OfferCard
              eyebrow="Promo access"
              title={`Buy now while the course is still available at ${pricing.promo}.`}
              description="This is a strong entry point for anyone ready to learn a practical production skill with business potential."
              highlights={[
                "All 7 modules included",
                "Packaging and marketing guidance",
                "Free e-book bonus",
              ]}
              originalPrice={pricing.original}
              promoPrice={pricing.promo}
              primaryHref={paymentHref}
              secondaryHref={phoneHref}
              secondaryLabel="Call 08148293945"
            />
          </div>
        </section>

        <section id="faq" className="section-space bg-white/55">
          <div className="container-shell">
            <SectionHeading
              eyebrow="FAQ"
              title="Practical answers before you buy."
              description="Everything here is designed to remove uncertainty so you can make a clear decision and move quickly when you are ready."
              align="center"
            />
            <div className="mx-auto mt-10 grid max-w-4xl gap-4">
              {faqs.map((item) => (
                <FaqItem
                  key={item.question}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="section-space">
          <div className="container-shell">
            <div className="surface-card overflow-hidden bg-[linear-gradient(135deg,rgba(217,235,246,0.95),rgba(255,255,255,0.92)_52%,rgba(245,216,223,0.92))] px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <span className="section-kicker">
                    <SparklesIcon className="h-4 w-4" />
                    Ready to start?
                  </span>
                  <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight text-brand-navy sm:text-5xl">
                    Learn a valuable skill, start with what you have, and build
                    toward income with more confidence.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                    You do not need to wait until everything feels perfect. If
                    you are ready to learn step by step and turn practical
                    knowledge into opportunity, this is a strong place to begin.
                  </p>
                </div>
                <div className="lg:justify-self-end">
                  <div className="surface-card max-w-xl p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy/60">
                      Your next step
                    </p>
                    <p className="mt-3 text-lg leading-8 text-muted-foreground">
                      Buy through the payment link now, or call directly if you
                      want to speak to the team first.
                    </p>
                    <CtaButtons
                      primaryHref={paymentHref}
                      secondaryHref={phoneHref}
                      primaryLabel="Buy Now"
                      secondaryLabel="Call 08148293945"
                      className="mt-6"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t soft-divider bg-white/70 py-8">
        <div className="container-shell flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {"\u00A9"} 2026 {brandName}. Practical skills for purposeful growth.
          </p>
          <div className="flex items-center gap-4">
            <a href={phoneHref} className="font-semibold text-brand-navy">
              08148293945
            </a>
            <a
              href={paymentHref}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-coral"
            >
              Buy Now
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
