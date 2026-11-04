import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, History, LayoutTemplate, Plus } from "lucide-react";
import { getSessionUser } from "@/lib/supabase/server";
import { countRows, listHistory, listProjects } from "@/lib/account/repo";
import { getContentType, isContentTypeId } from "@/lib/payloads";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ProjectThumb } from "@/components/dashboard/project-thumb";

type SP = Promise<Record<string, string | string[] | undefined>>;

const NOTICES: Record<string, string> = {
  verified: "Your email address is verified. Welcome to VirhinoQR!",
  "password-updated": "Your password has been updated. Other sessions were signed out.",
};

export default async function DashboardOverview({ searchParams }: { searchParams: SP }) {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/dashboard");
  const sb = session.supabase;
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const [projects, templates, activity, recent, history] = await Promise.all([
    countRows(sb, "qr_projects"),
    countRows(sb, "user_templates"),
    countRows(sb, "qr_history", 30),
    listProjects(sb, { limit: 4 }).catch(() => []),
    listHistory(sb, { pageSize: 5 }).catch(() => ({ rows: [], total: 0 })),
  ]);

  const stats = [
    { label: "Saved QR projects", value: projects, href: "/dashboard/projects", icon: FolderKanban },
    { label: "QR activity (30 days)", value: activity, href: "/dashboard/history", icon: History },
    { label: "Cloud templates", value: templates, href: "/dashboard/templates", icon: LayoutTemplate },
  ];

  return (
    <div className="space-y-6">
      {notice && (
        <Notice tone="success">
          <span data-testid="dashboard-notice">{notice}</span>
        </Notice>
      )}
      <section aria-labelledby="overview-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 id="overview-title" className="text-2xl font-bold tracking-tight">
            Overview
          </h1>
          <ButtonLink href="/create" icon={<Plus className="size-4" aria-hidden="true" />} className="bg-[#5E17EB] hover:bg-[#4A10C4]">
            Create a QR code
          </ButtonLink>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, href, icon: Icon }) => (
            <li key={label}>
              <Link href={href} className="flex items-center gap-4 rounded-modal border border-line bg-white p-5 transition-shadow hover:shadow-e2" data-testid={`stat-${href.split("/").pop()}`}>
                <span className="flex size-11 items-center justify-center rounded-card bg-gradient-to-br from-[#5E17EB] to-[#005DFB] text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-2xl font-bold tabular-nums">{value}</span>
                  <span className="text-sm text-ink-2">{label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="recent-projects" className="rounded-modal border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-projects" className="font-semibold">
              Recent projects
            </h2>
            <Link href="/dashboard/projects" className="text-sm font-semibold text-[#005DFB] hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-2">No saved projects yet. Design a code in the studio and choose “Save project”.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              {recent.map((p) => (
                <li key={p.id}>
                  <Link href={`/create?project=${p.id}`} className="block rounded-card border border-line p-2 hover:border-[#5E17EB]">
                    <ProjectThumb project={p} />
                    <span className="mt-1 block truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-ink-3">{getContentType(p.contentType)!.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-activity" className="rounded-modal border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-activity" className="font-semibold">
              Recent activity
            </h2>
            <Link href="/dashboard/history" className="text-sm font-semibold text-[#005DFB] hover:underline">
              Full history
            </Link>
          </div>
          {history.rows.length === 0 ? (
            <p className="text-sm text-ink-2">Downloads, saves and bulk exports will appear here.</p>
          ) : (
            <ul className="divide-y divide-line text-sm" data-testid="recent-activity">
              {history.rows.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.label}</span>
                    <span className="text-xs text-ink-3">
                      {h.action === "download" ? `Downloaded ${h.format?.toUpperCase() ?? ""}` : h.action === "save" ? "Saved project" : "Bulk export"} · {isContentTypeId(h.content_type) ? getContentType(h.content_type)!.label : h.content_type}
                    </span>
                  </span>
                  <time className="shrink-0 text-xs text-ink-3" dateTime={h.created_at}>
                    {new Date(h.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
