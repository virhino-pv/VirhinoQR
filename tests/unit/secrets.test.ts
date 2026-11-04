import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const SRC = sources(join(process.cwd(), "src"));

describe("secret handling in application code", () => {
  it("never reads the service-role key or the database URL", () => {
    const hits = SRC.filter((f) => /SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|SUPABASE_SECRET/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("only NEXT_PUBLIC_* variables are referenced from client components", () => {
    const offenders: string[] = [];
    for (const f of SRC) {
      const text = readFileSync(f, "utf8");
      if (!text.startsWith('"use client"')) continue;
      for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) if (!m[1]!.startsWith("NEXT_PUBLIC_")) offenders.push(`${f}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("never logs environment values", () => {
    const offenders = SRC.filter((f) => /console\.(log|info|warn|error|debug)\([^)]*process\.env/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("server-only Supabase module is guarded against client import", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/supabase/server.ts"), "utf8")).toMatch(/^import "server-only";/);
  });

  it(".env files are git-ignored and .env.example holds placeholders only", () => {
    const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^\.env\.\*$/m);
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).not.toMatch(/sb_secret_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{20,}\.|postgres(ql)?:\/\/[^<\s]*:[^<\s@]+@/);
  });
});
