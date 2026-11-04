"use client";

import { create } from "zustand";
import { CONTENT_TYPES, getContentType, type ContentTypeId, type FormValues } from "@/lib/payloads";
import { defaultTimeZone } from "@/lib/payloads/time";
import { cloneDesign } from "@/lib/qr/engine/design";
import type { Design, LogoAsset } from "@/lib/qr/engine/types";
import type { ExportFormat } from "@/lib/qr/export/filename";

export interface ExportSettings {
  format: ExportFormat;
  /** Raster/SVG size in px. */
  sizePx: number;
  /** Physical size for PDF/EPS in millimetres. */
  printMm: number;
  /** PNG pixel density metadata. */
  dpi: number;
}

export const EXPORT_LIMITS = { minPx: 128, maxPx: 4096, minMm: 10, maxMm: 1000 } as const;

export interface StudioState {
  typeId: ContentTypeId;
  /** Per-type drafts, so switching types never loses typed content. */
  drafts: Partial<Record<ContentTypeId, FormValues>>;
  /** Fields the user has left (errors show after blur or once the form is complete). */
  touched: Record<string, boolean>;
  design: Design;
  logo: LogoAsset | null;
  exportSettings: ExportSettings;

  setType(id: ContentTypeId): void;
  setField(name: string, value: string | boolean): void;
  touch(name: string): void;
  touchAll(names: string[]): void;
  updateDesign(mutate: (d: Design) => void): void;
  resetDesign(): void;
  setLogo(logo: LogoAsset | null): void;
  setExport(patch: Partial<ExportSettings>): void;
}

export function initialValues(id: ContentTypeId): FormValues {
  const def = getContentType(id)!;
  const values = { ...def.defaults };
  if (id === "event") values.timezone = defaultTimeZone();
  return values;
}

export const useStudio = create<StudioState>((set) => ({
  typeId: CONTENT_TYPES[0]!.id,
  drafts: {},
  touched: {},
  design: cloneDesign(),
  logo: null,
  exportSettings: { format: "png", sizePx: 1024, printMm: 50, dpi: 300 },

  setType: (id) =>
    set((s) => ({
      typeId: id,
      touched: {},
      drafts: s.drafts[id] ? s.drafts : { ...s.drafts, [id]: initialValues(id) },
    })),
  setField: (name, value) =>
    set((s) => ({
      drafts: { ...s.drafts, [s.typeId]: { ...(s.drafts[s.typeId] ?? initialValues(s.typeId)), [name]: value } },
    })),
  touch: (name) => set((s) => (s.touched[name] ? s : { touched: { ...s.touched, [name]: true } })),
  touchAll: (names) => set((s) => ({ touched: { ...s.touched, ...Object.fromEntries(names.map((n) => [n, true])) } })),
  updateDesign: (mutate) =>
    set((s) => {
      const next = structuredClone(s.design);
      mutate(next);
      return { design: next };
    }),
  resetDesign: () => set({ design: cloneDesign(), logo: null }),
  setLogo: (logo) => set({ logo }),
  setExport: (patch) => set((s) => ({ exportSettings: { ...s.exportSettings, ...patch } })),
}));

/**
 * Seeds the store from the URL (?type=…&url=…) when the studio mounts. State is replaced, not
 * merged, so a server render never carries values over from an earlier request.
 */
export function initStudio(typeId: ContentTypeId, prefill: FormValues) {
  const values = { ...initialValues(typeId), ...prefill };
  useStudio.setState({ typeId, touched: {}, drafts: { [typeId]: values }, design: cloneDesign(), logo: null });
}

export function currentValues(s: Pick<StudioState, "drafts" | "typeId">): FormValues {
  return s.drafts[s.typeId] ?? initialValues(s.typeId);
}
