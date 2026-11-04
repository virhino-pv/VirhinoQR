import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates/builtin";
import {
  FILE_FORMAT,
  IMPORT_MAX_BYTES,
  TEMPLATE_LIMIT,
  cleanTemplateName,
  createTemplate,
  exportTemplates,
  importTemplates,
  sameDesign,
  validateTemplateName,
} from "@/lib/templates/model";
import { cloneDesign, designSchema } from "@/lib/qr/engine/design";
import { buildScene } from "@/lib/qr/engine/scene";
import { buildPayload, getContentType } from "@/lib/payloads";
import { decodeScene } from "../helpers/render";

const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==";

describe("built-in templates", () => {
  it("has at least 12 uniquely named, schema-valid designs in known categories", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.id)).size).toBe(BUILTIN_TEMPLATES.length);
    expect(new Set(BUILTIN_TEMPLATES.map((t) => t.name)).size).toBe(BUILTIN_TEMPLATES.length);
    const cats = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of BUILTIN_TEMPLATES) {
      expect(designSchema.safeParse(t.design).success, t.id).toBe(true);
      expect(cats.has(t.category)).toBe(true);
    }
  });

  const vcard = buildPayload(getContentType("vcard")!, getContentType("vcard")!.sample);
  const payloads = ["https://qr-studio.example/templates", vcard.status === "ok" ? vcard.payload : ""];
  it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t] as const))("%s scans with a short URL and a full vCard", async (_id, t) => {
    for (const text of payloads) {
      expect(await decodeScene(buildScene({ text, design: t.design }), 500)).toEqual([text]);
    }
  });
});

describe("template names", () => {
  it("are trimmed, collapsed and stripped of control characters", () => {
    expect(cleanTemplateName("  My \n  brand\u0007  ")).toBe("My brand");
    expect(validateTemplateName("   ")).toMatch(/name/);
    expect(validateTemplateName("x".repeat(61))).toMatch(/60/);
    expect(validateTemplateName("Spring sale")).toBeNull();
  });
});

describe("export / import", () => {
  const design = cloneDesign();
  design.bodyShape = "dots";
  design.foreground = { mode: "linear", color1: "#123456", color2: "#654321", angle: 30 };
  const a = createTemplate("Brand A", design, { dataUrl: PNG_URL, name: "logo.png" }, new Date("2026-11-01T10:00:00Z"));
  const b = createTemplate("Plain", cloneDesign(), null, new Date("2026-11-02T10:00:00Z"));

  it("round-trips designs and logos with fresh ids", () => {
    const text = exportTemplates([a, b]);
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe(FILE_FORMAT);
    expect(parsed.templates[0].id).toBeUndefined();
    const out = importTemplates(text, text.length);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.skipped).toEqual([]);
    const [ia, ib] = out.result.templates;
    expect(ia!.name).toBe("Brand A");
    expect(sameDesign(ia!.design, a.design)).toBe(true);
    expect(ia!.logo).toEqual(a.logo);
    expect(ia!.createdAt).toBe(a.createdAt);
    expect(ia!.id).not.toBe(a.id);
    expect(ib!.logo).toBeNull();
  });

  it("skips invalid entries but keeps valid ones", () => {
    const text = JSON.stringify({
      format: FILE_FORMAT,
      version: 1,
      templates: [
        { name: "Good", design: cloneDesign() },
        { name: "Bad colour", design: { ...cloneDesign(), foreground: { mode: "solid", color1: "red", color2: "#000000", angle: 0 } } },
        { name: "Bad logo", design: cloneDesign(), logo: { dataUrl: "data:image/svg+xml;base64,PHN2Zz4=", name: "x.svg" } },
        { name: "Remote logo", design: cloneDesign(), logo: { dataUrl: "https://evil.example/x.png", name: "x" } },
        { name: "   ", design: cloneDesign() },
        "not an object",
      ],
    });
    const out = importTemplates(text, text.length);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.templates.map((t) => t.name)).toEqual(["Good"]);
    expect(out.result.skipped.map((s) => s.name)).toEqual(["Bad colour", "Bad logo", "Remote logo", "#5", "#6"]);
    expect(out.result.skipped[0]!.reason).toMatch(/foreground\.color1/);
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["other format", JSON.stringify({ format: "something-else", version: 1, templates: [] }), /not a QR Studio templates file/],
    ["future version", JSON.stringify({ format: FILE_FORMAT, version: 2, templates: [] }), /unsupported version/],
    ["too many", JSON.stringify({ format: FILE_FORMAT, version: 1, templates: Array(TEMPLATE_LIMIT + 1).fill({}) }), /at most/],
  ])("rejects %s", (_n, text, msg) => {
    const out = importTemplates(text, text.length);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(msg);
  });

  it("rejects oversized files before parsing", () => {
    const out = importTemplates("{}", IMPORT_MAX_BYTES + 1);
    expect(out.ok).toBe(false);
  });
});
