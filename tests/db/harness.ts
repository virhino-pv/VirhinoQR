import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/** Real PostgreSQL (PGlite) + Supabase shim + the project's migrations, for RLS tests. */
export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(process.cwd(), "tests/db/supabase-shim.sql"), "utf8"));
  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

/** Creates an auth user the way GoTrue does (insert into auth.users → profile trigger). */
export async function createUser(db: PGlite, email: string, fullName: string): Promise<string> {
  await asSuperuser(db);
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1, $2, now()) returning id",
    [email, JSON.stringify({ full_name: fullName })],
  );
  return res.rows[0]!.id;
}

export async function asSuperuser(db: PGlite) {
  await db.exec("reset role; select set_config('request.jwt.claims', '', false);");
}

/** Switches the session to a signed-in user, exactly as PostgREST does for a JWT. */
export async function asUser(db: PGlite, userId: string) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
  await db.exec("set role authenticated;");
}

export async function asAnon(db: PGlite) {
  await db.exec("reset role; select set_config('request.jwt.claims', '{\"role\":\"anon\"}', false); set role anon;");
}

/** Runs a statement and returns the error message (or null if it succeeded). */
export async function errorOf(db: PGlite, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function rowCount(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query(sql, params);
  return r.affectedRows ?? r.rows.length;
}
