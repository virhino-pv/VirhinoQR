import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asSuperuser, asUser, createTestDatabase, createUser, errorOf, rowCount } from "../db/harness";
import { DEFAULT_DESIGN } from "@/lib/qr/engine/design";

/**
 * Executes the real migration on PostgreSQL (PGlite) with a Supabase-compatible shim and checks
 * Row Level Security with two users. This verifies the SQL and policies; it is not a live Supabase run.
 */

const DESIGN = JSON.stringify(DEFAULT_DESIGN);
let db: PGlite;
let A: string;
let B: string;
let projectA: string;
let projectB: string;
let templateB: string;

beforeAll(async () => {
  db = await createTestDatabase();
  A = await createUser(db, "user-a@example.com", "  User A  ");
  B = await createUser(db, "user-b@example.com", "User B");
  await asUser(db, A);
  projectA = (await db.query<{ id: string }>("insert into qr_projects (name, content_type, form_values, design) values ('A menu', 'url', '{\"url\":\"https://a.example\"}', $1) returning id", [DESIGN])).rows[0]!.id;
  await asUser(db, B);
  projectB = (await db.query<{ id: string }>("insert into qr_projects (name, content_type, form_values, design) values ('B wifi', 'wifi', '{\"ssid\":\"B\"}', $1) returning id", [DESIGN])).rows[0]!.id;
  templateB = (await db.query<{ id: string }>("insert into user_templates (name, design) values ('B style', $1) returning id", [DESIGN])).rows[0]!.id;
  await db.query("insert into qr_history (content_type, label, action, format, project_id) values ('wifi', 'B wifi', 'download', 'png', $1)", [projectB]);
}, 60_000);

describe("migration & profiles", () => {
  it("creates a profile for every new auth user (trimmed name, email copy)", async () => {
    await asSuperuser(db);
    const r = await db.query<{ id: string; full_name: string; email: string }>("select id, full_name, email from profiles order by email");
    expect(r.rows).toEqual([
      { id: A, full_name: "User A", email: "user-a@example.com" },
      { id: B, full_name: "User B", email: "user-b@example.com" },
    ]);
  });

  it("keeps the profile email in sync when the auth email changes", async () => {
    await asSuperuser(db);
    await db.query("update auth.users set email = 'user-a+new@example.com' where id = $1", [A]);
    expect((await db.query<{ email: string }>("select email from profiles where id = $1", [A])).rows[0]!.email).toBe("user-a+new@example.com");
    await db.query("update auth.users set email = 'user-a@example.com' where id = $1", [A]);
  });

  it("user A reads only their own profile", async () => {
    await asUser(db, A);
    const r = await db.query<{ id: string }>("select id from profiles");
    expect(r.rows.map((x) => x.id)).toEqual([A]);
    expect((await db.query("select * from profiles where id = $1", [B])).rows).toHaveLength(0);
  });

  it("user A can update allowed profile fields but not id, email or another profile", async () => {
    await asUser(db, A);
    expect(await rowCount(db, "update profiles set full_name = 'Alice', company_name = 'Acme' where id = $1", [A])).toBe(1);
    expect(await errorOf(db, "update profiles set email = 'x@evil.example' where id = $1", [A])).toMatch(/permission denied/);
    expect(await errorOf(db, "update profiles set id = $2 where id = $1", [A, B])).toMatch(/permission denied/);
    expect(await rowCount(db, "update profiles set full_name = 'hacked' where id = $1", [B])).toBe(0);
    expect(await errorOf(db, "update profiles set avatar_url = 'javascript:alert(1)' where id = $1", [A])).toMatch(/check constraint/);
    expect(await errorOf(db, "insert into profiles (id, full_name) values (gen_random_uuid(), 'x')")).toMatch(/permission denied/);
    expect(await errorOf(db, "delete from profiles where id = $1", [A])).toMatch(/permission denied/);
    await asSuperuser(db);
    expect((await db.query<{ full_name: string }>("select full_name from profiles where id = $1", [B])).rows[0]!.full_name).toBe("User B");
  });

  it("ensure_profile() repairs only the caller's missing profile; anon cannot call it", async () => {
    await asSuperuser(db);
    await db.query("delete from profiles where id = $1", [A]);
    await asUser(db, A);
    await db.query("select ensure_profile()");
    expect((await db.query("select id from profiles")).rows).toHaveLength(1);
    await asAnon(db);
    expect(await errorOf(db, "select ensure_profile()")).toMatch(/permission denied/);
  });
});

describe("qr_projects isolation", () => {
  it("each user sees only their own projects", async () => {
    await asUser(db, A);
    expect((await db.query<{ id: string }>("select id from qr_projects")).rows.map((r) => r.id)).toEqual([projectA]);
    await asUser(db, B);
    expect((await db.query<{ id: string }>("select id from qr_projects")).rows.map((r) => r.id)).toEqual([projectB]);
  });

  it("user A cannot read, update or delete B's project by id", async () => {
    await asUser(db, A);
    expect((await db.query("select * from qr_projects where id = $1", [projectB])).rows).toHaveLength(0);
    expect(await rowCount(db, "update qr_projects set name = 'pwned' where id = $1", [projectB])).toBe(0);
    expect(await rowCount(db, "delete from qr_projects where id = $1", [projectB])).toBe(0);
    await asSuperuser(db);
    expect((await db.query<{ name: string }>("select name from qr_projects where id = $1", [projectB])).rows[0]!.name).toBe("B wifi");
  });

  it("user A cannot create rows for B or move a row to B", async () => {
    await asUser(db, A);
    expect(await errorOf(db, "insert into qr_projects (user_id, name, content_type, design) values ($1, 'x', 'url', $2)", [B, DESIGN])).toMatch(/row-level security/);
    expect(await errorOf(db, "update qr_projects set user_id = $1 where id = $2", [B, projectA])).toMatch(/row-level security/);
  });

  it("constraints reject invalid data", async () => {
    await asUser(db, A);
    expect(await errorOf(db, "insert into qr_projects (name, content_type, design) values ('x', 'banana', $1)", [DESIGN])).toMatch(/check constraint/);
    expect(await errorOf(db, "insert into qr_projects (name, content_type, design) values ('   ', 'url', $1)", [DESIGN])).toMatch(/check constraint/);
    expect(await errorOf(db, "insert into qr_projects (name, content_type, design) values ('x', 'url', '[1,2]')")).toMatch(/check constraint/);
    expect(await errorOf(db, "insert into qr_projects (name, content_type, design, logo_path) values ('x', 'url', $1, $2)", [DESIGN, `${B}/projects/x.png`])).toMatch(/check constraint/);
    expect(await rowCount(db, "insert into qr_projects (name, content_type, design, logo_path) values ('ok', 'url', $1, $2)", [DESIGN, `${A}/projects/x.png`])).toBe(1);
  });

  it("updated_at changes on update", async () => {
    await asUser(db, A);
    const before = (await db.query<{ updated_at: Date }>("select updated_at from qr_projects where id = $1", [projectA])).rows[0]!.updated_at;
    await new Promise((r) => setTimeout(r, 15));
    await db.query("update qr_projects set name = 'A menu v2' where id = $1", [projectA]);
    const after = (await db.query<{ updated_at: Date }>("select updated_at from qr_projects where id = $1", [projectA])).rows[0]!.updated_at;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("qr_history isolation", () => {
  it("users see only their own history and cannot link another user's project", async () => {
    await asUser(db, A);
    expect((await db.query("select * from qr_history")).rows).toHaveLength(0);
    expect(await rowCount(db, "insert into qr_history (content_type, label, action, format, project_id) values ('url', 'A menu', 'download', 'png', $1)", [projectA])).toBe(1);
    expect(await errorOf(db, "insert into qr_history (content_type, label, action, project_id) values ('wifi', 'x', 'save', $1)", [projectB])).toMatch(/foreign key/);
    expect(await errorOf(db, "insert into qr_history (user_id, content_type, label, action) values ($1, 'url', 'x', 'save')", [B])).toMatch(/row-level security/);
    expect(await errorOf(db, "update qr_history set label = 'x'")).toMatch(/permission denied/);
    expect(await rowCount(db, "delete from qr_history where user_id = $1", [B])).toBe(0);
    await asUser(db, B);
    expect((await db.query("select * from qr_history")).rows).toHaveLength(1);
  });

  it("deleting a project keeps its history but clears the link", async () => {
    await asUser(db, A);
    const p = (await db.query<{ id: string }>("insert into qr_projects (name, content_type, design) values ('temp', 'text', $1) returning id", [DESIGN])).rows[0]!.id;
    await db.query("insert into qr_history (content_type, label, action, project_id) values ('text', 'temp', 'save', $1)", [p]);
    await db.query("delete from qr_projects where id = $1", [p]);
    const r = await db.query<{ project_id: string | null }>("select project_id from qr_history where label = 'temp'");
    expect(r.rows).toEqual([{ project_id: null }]);
  });
});

describe("user_templates isolation", () => {
  it("users manage only their own templates", async () => {
    await asUser(db, A);
    expect((await db.query("select * from user_templates")).rows).toHaveLength(0);
    expect((await db.query("select * from user_templates where id = $1", [templateB])).rows).toHaveLength(0);
    expect(await rowCount(db, "update user_templates set name = 'pwned' where id = $1", [templateB])).toBe(0);
    expect(await rowCount(db, "delete from user_templates where id = $1", [templateB])).toBe(0);
    // Re-using B's template id (e.g. an upsert from a crafted request) cannot overwrite it.
    expect(await errorOf(db, "insert into user_templates (id, name, design) values ($1, 'mine now', $2) on conflict (id) do update set name = excluded.name", [templateB, DESIGN])).toMatch(/row-level security|duplicate/);
    expect(await rowCount(db, "insert into user_templates (name, design) values ('A style', $1)", [DESIGN])).toBe(1);
    await asUser(db, B);
    expect((await db.query<{ name: string }>("select name from user_templates")).rows.map((r) => r.name)).toEqual(["B style"]);
  });
});

describe("anonymous access", () => {
  it.each(["profiles", "qr_projects", "qr_history", "user_templates"])("anon cannot read or write %s", async (table) => {
    await asAnon(db);
    expect(await errorOf(db, `select * from ${table}`)).toMatch(/permission denied/);
    expect(await errorOf(db, `delete from ${table}`)).toMatch(/permission denied/);
  });
  it("anon cannot insert projects", async () => {
    await asAnon(db);
    expect(await errorOf(db, "insert into qr_projects (name, content_type, design) values ('x', 'url', '{}')")).toMatch(/permission denied/);
  });
});

describe("logo storage policies", () => {
  it("users can write and read only inside their own folder of the private bucket", async () => {
    await asSuperuser(db);
    expect((await db.query<{ public: boolean }>("select public from storage.buckets where id = 'user-logos'")).rows[0]!.public).toBe(false);
    await asUser(db, A);
    expect(await rowCount(db, "insert into storage.objects (bucket_id, name) values ('user-logos', $1)", [`${A}/projects/1.png`])).toBe(1);
    expect(await errorOf(db, "insert into storage.objects (bucket_id, name) values ('user-logos', $1)", [`${B}/projects/evil.png`])).toMatch(/row-level security/);
    expect(await errorOf(db, "insert into storage.objects (bucket_id, name) values ('user-logos', 'evil.png')")).toMatch(/row-level security/);
    await asUser(db, B);
    expect(await rowCount(db, "insert into storage.objects (bucket_id, name) values ('user-logos', $1)", [`${B}/templates/1.png`])).toBe(1);
    expect((await db.query("select name from storage.objects")).rows).toEqual([{ name: `${B}/templates/1.png` }]);
    expect(await rowCount(db, "delete from storage.objects where name = $1", [`${A}/projects/1.png`])).toBe(0);
    await asAnon(db);
    expect((await db.query("select name from storage.objects")).rows).toHaveLength(0);
  });
});

describe("account deletion", () => {
  it("removes all of the user's rows, and only theirs", async () => {
    await asSuperuser(db);
    await db.query("delete from auth.users where id = $1", [A]);
    for (const t of ["profiles", "qr_projects", "qr_history", "user_templates"]) {
      const col = t === "profiles" ? "id" : "user_id";
      expect((await db.query(`select 1 from ${t} where ${col} = $1`, [A])).rows, t).toHaveLength(0);
      expect((await db.query(`select 1 from ${t} where ${col} = $1`, [B])).rows.length, t).toBeGreaterThan(0);
    }
  });
});

describe("optimistic concurrency", () => {
  it("revision increments on every update and a stale writer matches no rows", async () => {
    await asUser(db, B);
    const t = (await db.query<{ id: string; revision: number }>("insert into user_templates (name, design) values ('rev', '{}') returning id, revision")).rows[0]!;
    expect(t.revision).toBe(1);
    expect(await rowCount(db, "update user_templates set name = 'device 1', revision = 99 where id = $1 and revision = 1", [t.id])).toBe(1);
    const now = (await db.query<{ revision: number; name: string }>("select revision, name from user_templates where id = $1", [t.id])).rows[0]!;
    expect(now).toEqual({ revision: 2, name: "device 1" }); // client-supplied revision ignored
    expect(await rowCount(db, "update user_templates set name = 'stale device' where id = $1 and revision = 1", [t.id])).toBe(0);
  });
});
