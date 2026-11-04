import { describe, expect, it } from "vitest";
import { isSecretKey, parseSupabaseConfig } from "@/lib/supabase/config";
import { isProtected, safeNext } from "@/lib/auth/redirect";
import { authErrorMessage, loginSchema, newPasswordSchema, passwordSchema, profileSchema, registerSchema, fieldErrors } from "@/lib/auth/validation";
import { downloadHistoryLabel, historyLabel, historyMetadata, logoPath, parseProject, projectPayload, type ProjectRow } from "@/lib/account/model";
import { DEFAULT_DESIGN } from "@/lib/qr/engine/design";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
const PUBLISHABLE = "sb_publishable_abcdefghijklmnopqrstuvwxyz012345";

describe("Supabase configuration", () => {
  it("accepts a project URL with a publishable or legacy anon key", () => {
    expect(parseSupabaseConfig({ url: "https://gcexwwtvnevrtoltfhoa.supabase.co", publishableKey: PUBLISHABLE })).toEqual({
      ok: true,
      config: { url: "https://gcexwwtvnevrtoltfhoa.supabase.co", publishableKey: PUBLISHABLE },
    });
    expect(parseSupabaseConfig({ url: "https://x.supabase.co", anonKey: jwt({ role: "anon", iss: "supabase" }) }).ok).toBe(true);
    expect(parseSupabaseConfig({ url: "http://127.0.0.1:54321", publishableKey: PUBLISHABLE }).ok).toBe(true);
  });

  it("treats a missing configuration as 'accounts disabled', not as an error", () => {
    expect(parseSupabaseConfig({})).toMatchObject({ ok: false, reason: "missing" });
  });

  it.each([
    ["service_role JWT", jwt({ role: "service_role" })],
    ["new-style secret key", "sb_secret_abcdefghijklmnopqrstuvwxyz0123"],
  ])("refuses a %s as public key without echoing it", (_n, key) => {
    expect(isSecretKey(key)).toBe(true);
    const r = parseSupabaseConfig({ url: "https://x.supabase.co", publishableKey: key });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    if (!r.ok) expect(r.message).not.toContain(key);
  });

  it("refuses database connection strings and non-https URLs", () => {
    const pg = "postgresql://postgres:hunter2-secret@db.gcexwwtvnevrtoltfhoa.supabase.co:5432/postgres";
    const r1 = parseSupabaseConfig({ url: pg, publishableKey: PUBLISHABLE });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.message).not.toContain("hunter2");
    expect(parseSupabaseConfig({ url: "https://x.supabase.co", publishableKey: pg }).ok).toBe(false);
    expect(parseSupabaseConfig({ url: "http://x.supabase.co", publishableKey: PUBLISHABLE }).ok).toBe(false);
    expect(parseSupabaseConfig({ url: "not a url", publishableKey: PUBLISHABLE }).ok).toBe(false);
  });
});

describe("redirect safety", () => {
  it.each([
    ["/dashboard/projects?x=1", "/dashboard/projects?x=1"],
    ["/create?project=abc#top", "/create?project=abc#top"],
    ["https://evil.example/", "/dashboard"],
    ["//evil.example/path", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/x\nSet-Cookie: a=b", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
  ])("safeNext(%j) → %s", (input, expected) => {
    expect(safeNext(input as string | null)).toBe(expected);
  });
  it("protects only dashboard routes", () => {
    expect(isProtected("/dashboard")).toBe(true);
    expect(isProtected("/dashboard/projects")).toBe(true);
    expect(isProtected("/dashboards")).toBe(false);
    expect(isProtected("/create")).toBe(false);
  });
});

describe("registration / login / reset validation", () => {
  const valid = { fullName: "Ada Lovelace", email: "Ada@Example.com ", password: "analytical-1843", confirmPassword: "analytical-1843" };
  it("accepts a valid registration and normalises the email", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success && r.data.email).toBe("ada@example.com");
  });
  it.each([
    [{ fullName: " " }, "fullName", /name/],
    [{ email: "not-email" }, "email", /valid email/],
    [{ password: "short1", confirmPassword: "short1" }, "password", /10 characters/],
    [{ password: "onlyletters-here", confirmPassword: "onlyletters-here" }, "password", /number/],
    [{ password: "1234567890123", confirmPassword: "1234567890123" }, "password", /letter/],
    [{ confirmPassword: "different-1234" }, "confirmPassword", /match/],
    [{ password: " leading-space-1", confirmPassword: " leading-space-1" }, "password", /space/],
    [{ password: "x1".repeat(40), confirmPassword: "x1".repeat(40) }, "password", /72/],
  ])("rejects %j", (patch, field, msg) => {
    const r = registerSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)[field]).toMatch(msg);
  });
  it("rejects using the email as password", () => {
    const r = registerSchema.safeParse({ ...valid, email: "pass12345word@x.io", password: "pass12345word@x.io", confirmPassword: "pass12345word@x.io" });
    expect(r.success).toBe(false);
  });
  it("login requires email and password; reset requires matching strong passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "new-password-1", confirmPassword: "new-password-1" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "new-password-1", confirmPassword: "new-password-2" }).success).toBe(false);
    expect(passwordSchema.safeParse("தமிழ்கடவுச்சொல்123").success).toBe(true);
  });
  it("profile validation allows only https avatar links", () => {
    expect(profileSchema.safeParse({ fullName: "A", companyName: "", avatarUrl: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "A", companyName: "", avatarUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: "A", companyName: "", avatarUrl: "http://x.io/a.png" }).success).toBe(false);
  });
});

describe("auth error messages", () => {
  it.each([
    [{ code: "invalid_credentials" }, /incorrect/],
    [{ code: "email_not_confirmed" }, /verify your email/],
    [{ code: "user_already_exists" }, /already exists/],
    [{ code: "weak_password" }, /too weak/],
    [{ code: "otp_expired" }, /invalid or has expired/],
    [{ status: 429 }, /Too many attempts/],
    [{ message: "fetch failed", status: 0 }, /couldn't reach/],
    [{ message: "internal: relation auth.users at 10.0.0.3 failed" }, /^Something went wrong/],
  ])("%j", (err, msg) => {
    expect(authErrorMessage(err)).toMatch(msg);
  });
  it("never echoes unknown server text", () => {
    expect(authErrorMessage({ message: "secret stack trace with token eyJhbGc" })).not.toContain("eyJ");
  });
});

describe("history privacy", () => {
  it("metadata drops sensitive keys and oversized values", () => {
    expect(historyMetadata({ version: 3, ec: "M", password: "x", payload: "WIFI:…", email: "a@b.co", size: "1024px", note: "x".repeat(300), empty: null })).toEqual({ version: 3, ec: "M", size: "1024px" });
  });
  it("download labels include the hint only for public link types", () => {
    expect(downloadHistoryLabel("url", "Website", "example.com")).toBe("Website · example.com");
    expect(downloadHistoryLabel("wifi", "Wi-Fi", "HomeNetwork")).toBe("Wi-Fi");
    expect(downloadHistoryLabel("phone", "Phone", "+447700900123")).toBe("Phone");
    expect(downloadHistoryLabel("email", "Email", "ada")).toBe("Email");
    expect(downloadHistoryLabel("wifi", "Wi-Fi", "Home", "Office Wi-Fi poster")).toBe("Office Wi-Fi poster");
    expect(historyLabel("  a\u0000b  ", "x")).toBe("a b");
  });
});

describe("loading saved projects", () => {
  const row = (patch: Partial<ProjectRow>): ProjectRow => ({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Menu",
    content_type: "url",
    form_values: { url: "example.com/menu" },
    design: DEFAULT_DESIGN,
    logo_path: null,
    logo_name: null,
    revision: 3,
    created_at: "2026-11-04T10:00:00Z",
    updated_at: "2026-11-04T11:00:00Z",
    ...patch,
  });
  it("parses a valid row and its real payload", () => {
    const p = parseProject(row({}), DEFAULT_DESIGN)!;
    expect(p).toMatchObject({ contentType: "url", revision: 3, warnings: [] });
    expect(projectPayload(p)).toBe("https://example.com/menu");
  });
  it("tolerates tampered or outdated data without crashing", () => {
    const p = parseProject(row({ design: { bodyShape: "unicorn" }, form_values: { url: { nested: true } } }), DEFAULT_DESIGN)!;
    expect(p.warnings).toHaveLength(2);
    expect(p.design).toEqual(DEFAULT_DESIGN);
    expect(projectPayload(p)).toBeNull();
    expect(parseProject(row({ content_type: "banana" }), DEFAULT_DESIGN)).toBeNull();
  });
  it("logo paths are always inside the owner's folder", () => {
    const u = "22222222-2222-4222-8222-222222222222";
    expect(logoPath(u, "projects", "11111111-1111-4111-8111-111111111111")).toBe(`${u}/projects/11111111-1111-4111-8111-111111111111.png`);
    expect(() => logoPath("../other", "projects", u)).toThrow();
  });
});
