import { ShieldCheck, ScanLine, Zap } from "lucide-react";
import { QuickGenerator } from "@/components/home/quick-generator";
import { StyleShowcase } from "@/components/home/style-showcase";
import { Faq, FAQ, FeatureGrid, SectionHeading, Steps, TypeGrid, UseCases } from "@/components/home/sections";
import { ButtonLink } from "@/components/ui/button";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-900 text-white" aria-labelledby="hero-title">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(60rem 30rem at 85% -10%, #6366f1 0%, transparent 60%), radial-gradient(40rem 20rem at 0% 110%, #f59e0b55 0%, transparent 60%)" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-brand-100">
              <ScanLine className="size-4" aria-hidden="true" /> Every design is scan-tested live
            </p>
            <h1 id="hero-title" className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Design QR codes <span className="text-accent-400">that actually scan.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-brand-100">
              22 content types, colours, gradients, shapes and logos — with instant PNG, SVG, PDF and EPS downloads. Free, private and generated entirely in your browser.
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100">
              <li className="flex items-center gap-1.5">
                <Zap className="size-4 text-accent-400" aria-hidden="true" /> Instant downloads
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-accent-400" aria-hidden="true" /> Nothing uploaded
              </li>
            </ul>
          </div>
          <QuickGenerator />
        </div>
      </section>

      <section id="types" className="bg-surface-1 py-16 sm:py-20" aria-labelledby="types-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="types-title" eyebrow="QR code types" title="What should your code open?" intro="Choose a type to open it in the studio with the right form." />
          <TypeGrid />
        </div>
      </section>

      <section className="py-16 sm:py-20" aria-labelledby="styles-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="styles-title" eyebrow="Customisation" title="Make it look like your brand" intro="Pick a style to preview it. These are live renders from the same engine you design with." />
          <StyleShowcase />
        </div>
      </section>

      <section id="features" className="bg-surface-1 py-16 sm:py-20" aria-labelledby="features-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="features-title" eyebrow="Features" title="Everything you need, nothing in the way" />
          <FeatureGrid />
        </div>
      </section>

      <section id="how-it-works" className="py-16 sm:py-20" aria-labelledby="how-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="how-title" eyebrow="How it works" title="From idea to print in three steps" />
          <Steps />
        </div>
      </section>

      <section id="use-cases" className="bg-surface-1 py-16 sm:py-20" aria-labelledby="use-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="use-title" eyebrow="Use cases" title="Built for real-world scanning" />
          <UseCases />
        </div>
      </section>

      <section id="faq" className="py-16 sm:py-20" aria-labelledby="faq-title">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
          <Faq />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6" aria-labelledby="cta-title">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 rounded-modal bg-brand-600 px-6 py-12 text-center text-white">
          <h2 id="cta-title" className="text-3xl font-bold tracking-tight">
            Ready to make yours?
          </h2>
          <p className="max-w-lg text-brand-100">No account, no watermark, no waiting.</p>
          <ButtonLink href="/create" variant="light" size="lg">
            Open the QR studio
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
