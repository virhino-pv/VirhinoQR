"use client";

import { useState } from "react";
import { ImagePlus, LayoutTemplate, Palette, Settings2, Shapes } from "lucide-react";
import type { ContentTypeId, FormValues } from "@/lib/payloads";
import type { Design } from "@/lib/qr/engine/types";
import { TemplatesPanel } from "./templates-panel";
import { SaveProjectPanel, useOpenFromAccount } from "./save-project-panel";
import { initStudio, useStudio } from "@/lib/store/studio";
import { TypePicker } from "./type-picker";
import { ContentForm } from "./content-form";
import { AdvancedPanel, ColorsPanel, Pane, ResetDesignButton, ShapesPanel } from "./design-panels";
import { LogoPanel } from "./logo-panel";
import { PreviewPanel, ScanBadge } from "./preview-panel";
import { ExportPanel } from "./export-panel";
import { useQrPipeline } from "./use-qr-pipeline";

export function Studio({ initialType, prefill, initialDesign, projectId, historyId, userTemplateId }: { initialType: ContentTypeId; prefill: FormValues; initialDesign?: Design; projectId?: string; historyId?: string; userTemplateId?: string }) {
  // Seed the store from the URL exactly once, before the first render reads it.
  const [seeded] = useState(() => {
    initStudio(initialType, prefill, initialDesign);
    return true;
  });
  const pipeline = useQrPipeline();
  const opened = useOpenFromAccount(projectId, historyId, userTemplateId);
  const transparent = useStudio((s) => s.design.background.transparent);
  const hasLogo = useStudio((s) => s.logo !== null);
  const { scene } = pipeline;

  return (
    <div className="bg-surface-1 pb-28 lg:pb-12" data-seeded={seeded}>
      <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6 sm:pt-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">QR studio</h1>
        <p className="mb-6 text-ink-2">Everything runs in your browser — nothing you enter is uploaded.</p>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-4">
            <TypePicker />
            <ContentForm result={pipeline.result} />
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-base font-semibold">3. Customise</h2>
              <ResetDesignButton />
            </div>
            <Pane title="Templates" icon={<LayoutTemplate className="size-5" aria-hidden="true" />} defaultOpen={Boolean(initialDesign || userTemplateId)} testId="pane-templates">
              <TemplatesPanel previewText={pipeline.result.status === "ok" ? pipeline.result.payload : null} />
            </Pane>
            <Pane title="Colours" icon={<Palette className="size-5" aria-hidden="true" />} defaultOpen testId="pane-colours">
              <ColorsPanel />
            </Pane>
            <Pane title="Shapes" icon={<Shapes className="size-5" aria-hidden="true" />} testId="pane-shapes">
              <ShapesPanel />
            </Pane>
            <Pane title="Logo" icon={<ImagePlus className="size-5" aria-hidden="true" />} testId="pane-logo">
              <LogoPanel obscuredRatio={hasLogo && scene ? scene.stats.obscuredRatio : null} budget={hasLogo && scene ? scene.stats.logoBudget : null} ec={scene?.ec ?? null} />
            </Pane>
            <Pane title="Error correction, size & margin" icon={<Settings2 className="size-5" aria-hidden="true" />} testId="pane-advanced">
              <AdvancedPanel />
            </Pane>
          </div>
          <aside id="preview" className="space-y-4 lg:sticky lg:top-20" aria-label="Preview and download">
            <PreviewPanel pipeline={pipeline} transparent={transparent} />
            <ExportPanel pipeline={pipeline} />
            <SaveProjectPanel pipeline={pipeline} openStatus={opened.status} />
          </aside>
        </div>
      </div>

      {/* Mobile: keep the code and its scan status in view while editing. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-e3 backdrop-blur lg:hidden" data-testid="mobile-bar">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3">
          <div className="size-14 shrink-0 overflow-hidden rounded-tile border border-line bg-white">
            {pipeline.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- live generated SVG
              <img src={pipeline.previewUrl} alt="" className="size-full" />
            )}
          </div>
          <div className="min-w-0 flex-1">{pipeline.previewUrl ? <ScanBadge status={pipeline.scan} className="text-xs" /> : <p className="text-sm text-ink-2">Fill in the form</p>}</div>
          <a href="#preview" className="inline-flex h-11 items-center rounded-card bg-brand-600 px-4 text-sm font-semibold text-white">
            Preview &amp; download
          </a>
        </div>
      </div>
    </div>
  );
}
