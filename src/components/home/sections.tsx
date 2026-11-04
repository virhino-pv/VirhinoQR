import Link from "next/link";
import {
  Coffee,
  Download,
  GraduationCap,
  House,
  ImagePlus,
  Languages,
  Palette,
  Printer,
  ScanLine,
  ShieldCheck,
  Store,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { CONTENT_TYPES } from "@/lib/payloads";
import { TYPE_ICONS } from "@/components/qr/type-icons";

export function SectionHeading({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: string; id: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold tracking-tight text-ink-1 sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-3 text-lg leading-relaxed text-ink-2">{intro}</p>}
    </div>
  );
}

export function TypeGrid() {
  const groups = [
    { title: "Encoded directly in the code", tier: "static" as const, note: "Works offline, forever — the content is inside the QR code." },
    {
      title: "Links to content you host",
      tier: "linked" as const,
      note: "These codes open your existing file, page or profile. Hosting uploads with QR Studio needs the upcoming dynamic tier.",
    },
  ];
  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <div key={g.tier}>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="text-lg font-semibold">{g.title}</h3>
            <p className="text-sm text-ink-2">{g.note}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {CONTENT_TYPES.filter((t) => t.tier === g.tier).map((t) => {
              const Icon = TYPE_ICONS[t.id];
              return (
                <li key={t.id}>
                  <Link
                    href={`/create?type=${t.id}`}
                    className="group flex h-full flex-col gap-2 rounded-card border border-line bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-e2"
                  >
                    <span className="flex size-10 items-center justify-center rounded-card bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-semibold text-ink-1">{t.label}</span>
                    <span className="text-sm leading-snug text-ink-2">{t.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: ScanLine, title: "Scan-checked as you design", text: "Every change is decoded by a real QR reader in your browser, so you know the code works before you print it." },
  { icon: Palette, title: "Colours & gradients", text: "Solid colours, linear or radial gradients, separate eye colours and transparent backgrounds — with contrast warnings." },
  { icon: ImagePlus, title: "Your logo, done safely", text: "Upload PNG, JPG or SVG, remove plain backgrounds, resize and position it. Error correction adjusts automatically." },
  { icon: Download, title: "Print-ready downloads", text: "PNG up to 4096 px, vector SVG, PDF and EPS. Instant downloads — no waiting, no watermarks." },
  { icon: ShieldCheck, title: "Private by design", text: "Codes are generated on your device. Your Wi-Fi passwords, contacts and logos are never uploaded." },
  { icon: Languages, title: "Any language", text: "Unicode text such as Tamil, Hindi, Japanese and emoji is encoded as UTF-8 and verified after decoding." },
];

export function FeatureGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ icon: Icon, title, text }) => (
        <li key={title} className="rounded-card border border-line bg-white p-6">
          <Icon className="mb-4 size-7 text-brand-600" aria-hidden="true" />
          <h3 className="mb-1.5 text-lg font-semibold">{title}</h3>
          <p className="leading-relaxed text-ink-2">{text}</p>
        </li>
      ))}
    </ul>
  );
}

const STEPS = [
  { title: "Choose what it opens", text: "Pick one of 22 content types — a link, Wi-Fi network, contact card, event, payment and more — and fill in the form." },
  { title: "Make it yours", text: "Set colours, shapes and your logo. The preview updates instantly and tells you whether it still scans." },
  { title: "Download and print", text: "Export PNG, SVG, PDF or EPS at the size you need. Test with your phone, then publish." },
];

export function Steps() {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative rounded-card bg-white p-6 shadow-e1">
          <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white" aria-hidden="true">
            {i + 1}
          </span>
          <h3 className="mb-1.5 text-lg font-semibold">
            <span className="sr-only">Step {i + 1}: </span>
            {s.title}
          </h3>
          <p className="leading-relaxed text-ink-2">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

const USE_CASES: Array<{ icon: LucideIcon; title: string; text: string; type: string; cta: string }> = [
  { icon: Coffee, title: "Cafés & restaurants", text: "Menus on tables and guest Wi-Fi without spelling out the password.", type: "wifi", cta: "Wi-Fi code" },
  { icon: Store, title: "Retail & packaging", text: "Product pages, manuals and reviews right from the shelf or box.", type: "url", cta: "Website code" },
  { icon: Ticket, title: "Events", text: "Add the date, time and venue to guests' calendars in one scan.", type: "event", cta: "Event code" },
  { icon: Printer, title: "Business cards", text: "Share your full contact details without typing errors.", type: "vcard", cta: "vCard code" },
  { icon: House, title: "Real estate", text: "Listing pages and directions on signs and flyers.", type: "location", cta: "Location code" },
  { icon: GraduationCap, title: "Education", text: "Worksheets, videos and reading lists for every classroom handout.", type: "pdf", cta: "PDF link code" },
];

export function UseCases() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {USE_CASES.map(({ icon: Icon, title, text, type, cta }) => (
        <li key={title} className="flex flex-col rounded-card border border-line bg-white p-6">
          <Icon className="mb-3 size-6 text-brand-600" aria-hidden="true" />
          <h3 className="mb-1 font-semibold">{title}</h3>
          <p className="mb-4 flex-1 text-ink-2">{text}</p>
          <Link href={`/create?type=${type}`} className="text-sm font-semibold text-brand-700 hover:underline">
            Create a {cta} →
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const FAQ: Array<{ q: string; a: string }> = [
  { q: "Is QR Studio free?", a: "Yes. Static QR codes — everything on this site today — are free to create and download, with no watermark and no sign-up." },
  { q: "Do my QR codes expire?", a: "No. A static code stores its content directly in the pattern, so it keeps working as long as the content (for example your web page) exists." },
  { q: "Is my data uploaded?", a: "No. Codes, logos and downloads are generated in your browser. Nothing you type is sent to our servers." },
  { q: "Can I change where a code points after printing?", a: "Not with a static code — the content is fixed inside it. Editable (dynamic) codes with scan statistics need an account and server, which are planned but not available yet." },
  { q: "Will a logo stop my code from scanning?", a: "A logo hides part of the code; error correction recovers it up to a limit. QR Studio raises error correction automatically, warns when the logo is too big and decode-tests the result." },
  { q: "Which format should I download?", a: "PNG for screens and quick printing, SVG for websites and design tools, PDF or EPS for professional print. Vector formats stay sharp at any size." },
  { q: "Why should I test before printing?", a: "Paper, lighting and phone cameras vary. Our built-in check is a strong signal, but always scan a printed proof with a couple of phones before a large print run." },
];

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-card border border-line bg-white">
      {FAQ.map((item) => (
        <details key={item.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-ink-1">
            {item.q}
            <span className="text-xl text-brand-600 transition-transform group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="pb-4 leading-relaxed text-ink-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

