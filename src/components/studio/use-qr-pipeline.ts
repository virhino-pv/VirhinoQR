"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPayload, getContentType, type PayloadResult } from "@/lib/payloads";
import { buildScene } from "@/lib/qr/engine/scene";
import { sceneToSvg } from "@/lib/qr/export/svg";
import { analyzeDesign, type ScanIssue } from "@/lib/qr/verify/heuristics";
import { scanScene } from "@/lib/qr/verify/browser-scan";
import { initialValues, useStudio } from "@/lib/store/studio";
import type { Scene } from "@/lib/qr/engine/types";

export type ScanStatus = "idle" | "checking" | "pass" | "fail" | "error";

export interface Pipeline {
  result: PayloadResult;
  scene: Scene | null;
  /** Encoding error (too much data, version too small…). */
  error: string | null;
  previewUrl: string | null;
  issues: ScanIssue[];
  scan: ScanStatus;
}

/**
 * form values → payload → scene → preview SVG, plus heuristics and a debounced, latest-wins
 * ZXing decode of the rendered output.
 */
export function useQrPipeline(): Pipeline {
  const typeId = useStudio((s) => s.typeId);
  const draft = useStudio((s) => s.drafts[s.typeId]);
  const design = useStudio((s) => s.design);
  const logo = useStudio((s) => s.logo);
  // Stable identity: the fallback is rebuilt only when the type changes, not on every render.
  const values = useMemo(() => draft ?? initialValues(typeId), [draft, typeId]);

  const result = useMemo(() => buildPayload(getContentType(typeId)!, values), [typeId, values]);
  const payload = result.status === "ok" ? result.payload : null;

  const built = useMemo((): { scene: Scene | null; error: string | null } => {
    if (!payload) return { scene: null, error: null };
    try {
      return { scene: buildScene({ text: payload, design, logo }), error: null };
    } catch (e) {
      return { scene: null, error: e instanceof Error ? e.message : "This content could not be encoded." };
    }
  }, [payload, design, logo]);

  const previewUrl = useMemo(
    () => (built.scene ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneToSvg(built.scene, { size: 640 }))}` : null),
    [built.scene],
  );
  const issues = useMemo(() => analyzeDesign(design, built.scene, Boolean(logo)), [design, built.scene, logo]);

  const [checked, setChecked] = useState<{ scene: Scene | null; status: ScanStatus }>({ scene: null, status: "idle" });
  useEffect(() => {
    const scene = built.scene;
    if (!scene || !payload) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const ok = await scanScene(scene, payload);
        if (!cancelled) setChecked({ scene, status: ok ? "pass" : "fail" });
      } catch {
        if (!cancelled) setChecked({ scene, status: "error" });
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [built.scene, payload]);

  const scan: ScanStatus = !built.scene ? "idle" : checked.scene === built.scene ? checked.status : "checking";
  return { result, scene: built.scene, error: built.error, previewUrl, issues, scan };
}
