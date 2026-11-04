"use client";

import Link from "next/link";
import { useTemplateLibrary } from "@/lib/templates/use-library";
import { MyTemplates } from "@/components/templates/my-templates";

export function TemplatesManager() {
  const library = useTemplateLibrary();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">My templates</h1>
      <p className="text-sm text-ink-2">
        Templates marked <strong>Synced</strong> live in your account and appear on every device you sign in on. Templates marked <strong>This device</strong> are stored only in this
        browser — upload them to sync. Save new templates from the <Link href="/create" className="font-semibold text-[#005DFB] hover:underline">studio</Link>; the{" "}
        <Link href="/templates" className="font-semibold text-[#005DFB] hover:underline">built-in templates</Link> are always available.
      </p>
      <div className="rounded-modal border border-line bg-white p-5" data-testid="dashboard-templates">
        <MyTemplates library={library} previewText="https://qr-studio.example" showSave={false} />
      </div>
    </div>
  );
}
