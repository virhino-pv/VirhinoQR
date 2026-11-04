import type { ReactNode } from "react";
import { accountsEnabled } from "@/lib/supabase/config";
import { Notice } from "@/components/ui/notice";
import { ButtonLink } from "@/components/ui/button";

export function AuthCard({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-surface-1 px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-modal border border-line bg-white p-6 shadow-e2 sm:p-8">
          <div className="mb-6 h-1.5 w-16 rounded-full bg-gradient-to-r from-[#5E17EB] via-[#005DFB] to-cyan-400" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {intro && <div className="mt-2 text-sm leading-relaxed text-ink-2">{intro}</div>}
          <div className="mt-6">{accountsEnabled ? children : <AccountsUnavailable />}</div>
        </div>
        {footer && accountsEnabled && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}

export function AccountsUnavailable() {
  return (
    <div className="space-y-4" data-testid="accounts-unavailable">
      <Notice tone="info" title="Accounts aren't set up on this installation">
        Everything else works without an account: create, customise and download QR codes, use templates and bulk generation.
      </Notice>
      <ButtonLink href="/create" className="w-full">
        Create a QR code
      </ButtonLink>
    </div>
  );
}

const MESSAGES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  "link-invalid": { tone: "error", text: "That link is invalid or has expired. Request a new one." },
  unreachable: { tone: "error", text: "We couldn't reach the account service. Please try again." },
  "not-configured": { tone: "error", text: "Accounts aren't set up on this installation." },
  "signed-out": { tone: "success", text: "You've been logged out." },
  "session-expired": { tone: "info", text: "Please log in to continue." },
};

export function QueryMessage({ code }: { code?: string }) {
  const m = code ? MESSAGES[code] : undefined;
  if (!m) return null;
  return (
    <Notice tone={m.tone} className="mb-4">
      <span data-testid="query-message">{m.text}</span>
    </Notice>
  );
}
