import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_URL, SITE_NAME, siteOrigin } from "@/lib/site";
import { siteUrl } from "@/lib/supabase/config";

afterEach(() => vi.unstubAllEnvs());

describe("site origin", () => {
  it("uses NEXT_PUBLIC_SITE_URL when set (normalised to the origin)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://virhinoqr.virhino.com/some/path");
    expect(siteOrigin()).toBe("https://virhinoqr.virhino.com");
    expect(siteUrl()).toBe("https://virhinoqr.virhino.com");
  });
  it("falls back to the production domain on Vercel production builds", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(siteOrigin()).toBe(PRODUCTION_URL);
  });
  it("uses localhost for local/preview builds without configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(siteOrigin()).toBe("http://localhost:3000");
  });
  it("ignores invalid or insecure values", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://virhinoqr.virhino.com");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(siteOrigin()).toBe(PRODUCTION_URL);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    vi.stubEnv("VERCEL_ENV", "");
    expect(siteOrigin()).toBe("http://localhost:3000");
  });
  it("brand constants", () => {
    expect(SITE_NAME).toBe("VirhinoQR");
    expect(PRODUCTION_URL).toBe("https://virhinoqr.virhino.com");
  });
});

describe(".env.production", () => {
  it("contains only the public site URL — no keys or secrets", () => {
    const text = readFileSync(join(process.cwd(), ".env.production"), "utf8");
    const vars = text
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .map((l) => l.split("=")[0]!.trim());
    expect(vars).toEqual(["NEXT_PUBLIC_SITE_URL"]);
    expect(text).toContain("NEXT_PUBLIC_SITE_URL=https://virhinoqr.virhino.com");
    expect(text).not.toMatch(/SUPABASE|SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD|sb_secret_|eyJ/);
  });
});
