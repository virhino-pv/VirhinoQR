import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-ink-2">The page you asked for doesn&apos;t exist.</p>
      <div className="flex gap-2">
        <ButtonLink href="/create">Create a QR code</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
