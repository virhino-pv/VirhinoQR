import { ScanLine } from "lucide-react";
import { QrImage } from "@/components/qr/qr-image";
import { projectPayload, type Project } from "@/lib/account/model";
import { cn } from "@/lib/cn";

/** Thumbnail that encodes the project's real content (logo omitted for speed). */
export function ProjectThumb({ project, className }: { project: Project; className?: string }) {
  const payload = projectPayload(project);
  if (!payload) {
    return (
      <div className={cn("flex aspect-square w-full items-center justify-center rounded-tile bg-surface-2", className)} title="Content incomplete">
        <ScanLine className="size-6 text-ink-3" aria-hidden="true" />
      </div>
    );
  }
  return <QrImage text={payload} design={project.design} alt="" size={160} className={cn("w-full", className)} />;
}
