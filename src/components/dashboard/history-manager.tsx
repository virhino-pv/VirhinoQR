"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { CONTENT_TYPES, getContentType, isContentTypeId } from "@/lib/payloads";
import { useAccount } from "@/lib/account/use-account";
import { clearHistory, deleteHistory, listHistory } from "@/lib/account/repo";
import type { HistoryRow } from "@/lib/account/model";
import { Button, buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

const PAGE = 20;
const ACTIONS: Record<string, string> = { download: "Download", save: "Saved project", bulk: "Bulk export" };

export function HistoryManager() {
  const account = useAccount();
  const sb = account.status === "signed-in" ? account.supabase : null;
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [type, setType] = useState("");
  const [action, setAction] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchPage = useCallback(
    async (p: number) => {
      if (!sb) return null;
      return listHistory(sb, { page: p, pageSize: PAGE, type: type || undefined, action: action || undefined });
    },
    [sb, type, action],
  );

  useEffect(() => {
    let cancelled = false;
    fetchPage(page)
      .then((r) => {
        if (!r || cancelled) return;
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setMsg({ tone: "error", text: "Your history could not be loaded." });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, page]);

  const reload = async () => {
    const r = await fetchPage(page);
    if (r) {
      setRows(r.rows);
      setTotal(r.total);
    }
  };

  const remove = async (h: HistoryRow) => {
    if (!sb) return;
    try {
      await deleteHistory(sb, h.id);
      setMsg({ tone: "success", text: "History entry deleted." });
      await reload();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Delete failed." });
    }
  };

  const clearAll = async () => {
    dialogRef.current?.close();
    if (!sb) return;
    try {
      await clearHistory(sb);
      setPage(0);
      setMsg({ tone: "success", text: "History cleared." });
      await reload();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Could not clear history." });
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">QR history</h1>
        {total > 0 && (
          <Button variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()} icon={<Trash2 className="size-4" aria-hidden="true" />}>
            Clear history
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-2">Downloads, saves and bulk exports made while signed in. History keeps the type and design — never the encoded content.</p>
      <div className="flex flex-col gap-2 rounded-modal border border-line bg-white p-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Filter by type</span>
          <Select value={type} onChange={(e) => (setType(e.target.value), setPage(0))} data-testid="history-type-filter">
            <option value="">All types</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex-1">
          <span className="sr-only">Filter by action</span>
          <Select value={action} onChange={(e) => (setAction(e.target.value), setPage(0))} data-testid="history-action-filter">
            <option value="">All actions</option>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}><span data-testid="history-status">{msg.text}</span></Notice>}</div>

      {rows === null ? (
        <p className="text-sm text-ink-2">Loading history…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-modal border border-dashed border-line bg-white p-10 text-center" data-testid="history-empty">
          <History className="size-10 text-[#005DFB]" aria-hidden="true" />
          <p className="font-semibold">No history {type || action ? "for this filter" : "yet"}</p>
          <p className="max-w-sm text-sm text-ink-2">Every QR code you download or save while signed in is listed here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-modal border border-line bg-white" data-testid="history-list">
          {rows.map((h) => {
            const typeLabel = isContentTypeId(h.content_type) ? getContentType(h.content_type)!.label : h.content_type;
            const reopen = h.project_id ? `/create?project=${h.project_id}` : isContentTypeId(h.content_type) ? `/create?type=${h.content_type}&history=${h.id}` : null;
            return (
              <li key={h.id} data-history={h.label} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{h.label}</p>
                  <p className="text-xs text-ink-3">
                    {ACTIONS[h.action]}
                    {h.format ? ` · ${h.format.toUpperCase()}` : ""} · {typeLabel} · <time dateTime={h.created_at}>{new Date(h.created_at).toLocaleString()}</time>
                  </p>
                </div>
                {reopen && h.action !== "bulk" && (
                  <Link href={reopen} className={buttonClasses("outline", "sm")} aria-label={`Reopen ${h.label}`}>
                    <RotateCcw className="size-3.5" aria-hidden="true" /> {h.project_id ? "Open project" : "Reuse design"}
                  </Link>
                )}
                <Button size="sm" variant="ghost" aria-label={`Delete history entry ${h.label}`} onClick={() => void remove(h)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="History pages" className="flex items-center justify-between text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <span className="text-ink-2">
            Page {page + 1} of {pages} · {total} entries
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Older
          </Button>
        </nav>
      )}

      <dialog ref={dialogRef} aria-labelledby="clear-history-title" className="m-auto w-[min(92vw,26rem)] rounded-modal p-0 shadow-e3 backdrop:bg-ink-1/50">
        <div className="space-y-4 p-6">
          <h2 id="clear-history-title" className="text-lg font-semibold">
            Clear all history?
          </h2>
          <p className="text-sm text-ink-2">All {total} entries are deleted. Saved projects are not affected.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" autoFocus onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearAll()}>
              Clear history
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
