import { expect, type Page } from "@playwright/test";
import type { ContentTypeDef, FormValues } from "../../src/lib/payloads/types";
import { isVisible } from "../../src/lib/payloads/helpers";

/** Fills a content form from a values object, honouring each field's kind and visibility. */
export async function fillForm(page: Page, type: ContentTypeDef, values: FormValues) {
  const merged = { ...type.defaults, ...values };
  // Segmented/select/checkbox fields first: they control which other fields are visible.
  const root = page.locator("#main form").first();
  const ordered = [...type.fields].sort((a, b) => rank(a.kind) - rank(b.kind));
  for (const f of ordered) {
    if (!isVisible(f, merged)) continue;
    const v = merged[f.name];
    switch (f.kind) {
      case "segmented":
        if (typeof v === "string" && v) {
          const option = f.options!.find((o) => o.value === v)!;
          await root.locator(`[role=radiogroup][data-name="${f.name}"]`).getByRole("radio", { name: option.label, exact: true }).click();
        }
        break;
      case "checkbox":
        await root.locator(`#field-${f.name}`).setChecked(v === true);
        break;
      case "select":
      case "timezone":
        if (typeof v === "string" && v) await root.locator(`select[name="${f.name}"]`).selectOption(v);
        break;
      case "datetime":
      case "date": {
        const input = root.locator(`input[name="${f.name}"]`);
        const type = await input.getAttribute("type");
        if (typeof v === "string" && v) await input.fill(type === "date" ? v.slice(0, 10) : v);
        break;
      }
      default:
        if (typeof v === "string") await root.locator(`[name="${f.name}"]`).fill(v);
    }
  }
}

function rank(kind: string) {
  return kind === "segmented" || kind === "select" || kind === "checkbox" ? 0 : 1;
}

export async function expectScans(page: Page) {
  await expect(page.locator("[data-scan]").first()).toHaveAttribute("data-scan", "pass", { timeout: 20_000 });
}
