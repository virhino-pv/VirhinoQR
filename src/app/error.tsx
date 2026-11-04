"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-ink-2">An unexpected error stopped this page. Your content was not uploaded anywhere — try again.</p>
      {error.digest && <p className="font-mono text-xs text-ink-3">Reference: {error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
