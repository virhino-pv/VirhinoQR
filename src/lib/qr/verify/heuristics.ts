import { contrastRatio, relativeLuminance } from "../engine/color";
import type { Design, Scene } from "../engine/types";

export type IssueLevel = "error" | "warning" | "info";

export interface ScanIssue {
  level: IssueLevel;
  code:
    | "low-contrast"
    | "inverted"
    | "eye-contrast"
    | "small-margin"
    | "logo-over-budget"
    | "logo-near-budget"
    | "logo-low-ec"
    | "transparent-background";
  message: string;
}

const MIN_CONTRAST = 3;

/**
 * Instant, rule-based readability checks. The decode test (verify/decode.ts) is the final
 * authority; these explain *why* a design may fail and run before it.
 */
export function analyzeDesign(design: Design, scene: Scene | null, hasLogo: boolean): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const bg = design.background.transparent ? "#ffffff" : design.background.color;
  const fgColors =
    design.foreground.mode === "solid" ? [design.foreground.color1] : [design.foreground.color1, design.foreground.color2];

  const worst = Math.min(...fgColors.map((c) => contrastRatio(c, bg)));
  const inverted = fgColors.some((c) => relativeLuminance(c) > relativeLuminance(bg));
  if (inverted) {
    issues.push({
      level: "error",
      code: "inverted",
      message: "The code is lighter than its background. Many scanners cannot read inverted codes — use a dark foreground on a light background.",
    });
  } else if (worst < MIN_CONTRAST) {
    issues.push({
      level: "error",
      code: "low-contrast",
      message: `Contrast between code and background is ${worst.toFixed(1)}:1. Use at least ${MIN_CONTRAST}:1 (darker code or lighter background).`,
    });
  } else if (worst < 4.5) {
    issues.push({
      level: "warning",
      code: "low-contrast",
      message: `Contrast is ${worst.toFixed(1)}:1 — scannable in good light, but 4.5:1 or more is safer for print and older phones.`,
    });
  }

  if (design.eyes.mode === "custom") {
    const eyeColors = [
      design.eyes.frame,
      design.eyes.ball,
      ...(design.eyes.perEye?.flatMap((e) => [e.frame, e.ball]) ?? []),
    ];
    const eyeWorst = Math.min(...eyeColors.map((c) => contrastRatio(c, bg)));
    const eyeInverted = eyeColors.some((c) => relativeLuminance(c) > relativeLuminance(bg));
    if (eyeInverted || eyeWorst < MIN_CONTRAST) {
      issues.push({
        level: "error",
        code: "eye-contrast",
        message: "An eye colour is too close to (or lighter than) the background. Scanners locate the code by its three eyes — keep them dark.",
      });
    }
  }

  if (design.margin < 2) {
    issues.push({
      level: "warning",
      code: "small-margin",
      message: `Quiet zone is ${design.margin} module${design.margin === 1 ? "" : "s"}. The standard asks for 4; below 2 many scanners struggle unless the code sits on a plain area.`,
    });
  }

  if (design.background.transparent) {
    issues.push({
      level: "info",
      code: "transparent-background",
      message: "Transparent background: place the code on a light, plain surface so it stays readable.",
    });
  }

  if (scene && hasLogo) {
    const { obscuredRatio, logoBudget } = scene.stats;
    if (obscuredRatio > logoBudget) {
      issues.push({
        level: "error",
        code: "logo-over-budget",
        message: `The logo hides ${(obscuredRatio * 100).toFixed(1)}% of the code; error correction ${scene.ec} safely tolerates about ${(logoBudget * 100).toFixed(0)}%. Make the logo smaller${scene.ec === "H" ? "" : " or raise error correction to H"}.`,
      });
    } else if (obscuredRatio > logoBudget * 0.8) {
      issues.push({
        level: "warning",
        code: "logo-near-budget",
        message: `The logo is close to the safe limit for error correction ${scene.ec}. Test with several phones before printing.`,
      });
    }
    if (scene.ec === "L" || scene.ec === "M") {
      issues.push({
        level: "warning",
        code: "logo-low-ec",
        message: `Logos remove data. Error correction ${scene.ec} leaves little margin — H is recommended.`,
      });
    }
  }
  return issues;
}

export function hasBlockingIssue(issues: ScanIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
