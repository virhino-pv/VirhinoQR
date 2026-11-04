import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(js|css|html|json|txt|map)$/.test(name)) out.push(p);
  }
  return out;
}

test("client bundles contain no server secrets (canaries injected into the build environment)", () => {
  const roots = [".next-e2e/static", ".next/static"];
  const all = roots.flatMap((r) => files(join(process.cwd(), r)));
  expect(all.length).toBeGreaterThan(10);
  const forbidden = ["E2E_CANARY", "service_role_must_never_ship", "postgresql://", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "mock-jwt-secret"];
  // Real secret keys look like sb_secret_<key>; the bare prefix appears legitimately in the detector
  // that refuses such keys (src/lib/supabase/config.ts).
  const secretKey = /sb_secret_[A-Za-z0-9_]{8,}/;
  const hits: string[] = [];
  for (const f of all) {
    const text = readFileSync(f, "utf8");
    for (const word of forbidden) if (text.includes(word)) hits.push(`${f}: ${word}`);
    if (secretKey.test(text)) hits.push(`${f}: secret key`);
  }
  expect(hits).toEqual([]);
  // The publishable key is expected in the accounts build (it is public by design).
  expect(files(join(process.cwd(), ".next-e2e/static")).some((f) => readFileSync(f, "utf8").includes("sb_publishable_e2e_mock_key"))).toBe(true);
});

test("auth pages are served with the security headers", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.status()).toBe(200);
  const h = res!.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
