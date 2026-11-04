// Test-only Supabase emulator for E2E: a subset of the GoTrue (auth/v1), PostgREST (rest/v1) and
// Storage (storage/v1) HTTP APIs used by QR Studio, backed by PGlite running the REAL migration.
// Every REST/storage request runs under the "authenticated" or "anon" Postgres role with the JWT
// claims set, so authorization is decided by the project's actual RLS policies and grants.
// This is NOT Supabase; it exists so auth flows and user isolation can be tested without credentials.

import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54400);
const SECRET = "mock-jwt-secret-not-for-production";
const ROOT = process.cwd();

// ---------------------------------------------------------------------------------------------
// Database
const db = new PGlite();
await db.exec(readFileSync(join(ROOT, "tests/db/supabase-shim.sql"), "utf8"));
for (const f of readdirSync(join(ROOT, "supabase/migrations")).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(ROOT, "supabase/migrations", f), "utf8"));
}

let chain = Promise.resolve();
/** PGlite has one session; role switching must be serialized. */
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

async function asRole(claims, fn) {
  return exclusive(async () => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, false)", [claims ? JSON.stringify(claims) : ""]);
    if (claims) await db.exec(`set role ${claims.role === "authenticated" ? "authenticated" : "anon"}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Auth state
const passwords = new Map(); // userId -> sha256(password)
const tokens = new Map(); // token_hash -> { userId, type, expires }
const refreshTokens = new Map(); // token -> { userId, sessionId }
const outbox = []; // { to, type, link, tokenHash, at }
const storageFiles = new Map(); // "bucket/path" -> { bytes, type }

const hash = (s) => createHash("sha256").update(s).digest("hex");
const b64url = (b) => Buffer.from(b).toString("base64url");

function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, b, s] = (token || "").split(".");
  if (!h || !b || !s) return null;
  const expected = createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

async function getUser(id) {
  return exclusive(async () => (await db.query("select * from auth.users where id = $1", [id])).rows[0] ?? null);
}
async function getUserByEmail(email) {
  return exclusive(async () => (await db.query("select * from auth.users where lower(email) = lower($1)", [email])).rows[0] ?? null);
}

function userJson(u) {
  const confirmed = u.email_confirmed_at ? new Date(u.email_confirmed_at).toISOString() : null;
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: confirmed,
    confirmed_at: confirmed,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { ...u.raw_user_meta_data, email: u.email, email_verified: Boolean(confirmed), sub: u.id },
    identities: [{ id: u.id, user_id: u.id, provider: "email", identity_data: { sub: u.id, email: u.email }, created_at: new Date(u.created_at).toISOString() }],
    created_at: new Date(u.created_at).toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
}

function issueSession(u, sessionId = randomUUID()) {
  const now = Math.floor(Date.now() / 1000);
  const user = userJson(u);
  const access_token = signJwt({
    sub: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_verified: Boolean(u.email_confirmed_at),
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
    session_id: sessionId,
    aal: "aal1",
    iat: now,
    exp: now + 3600,
  });
  const refresh_token = randomBytes(24).toString("hex");
  refreshTokens.set(refresh_token, { userId: u.id, sessionId });
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token, user };
}

function newEmailToken(userId, type) {
  const tokenHash = randomBytes(20).toString("hex");
  tokens.set(tokenHash, { userId, type, expires: Date.now() + 3600_000 });
  return tokenHash;
}

function sendEmail(to, type, redirectTo, tokenHash) {
  const url = new URL(redirectTo || "http://localhost:3000/auth/callback");
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type === "recovery" ? "recovery" : "email");
  outbox.push({ to: to.toLowerCase(), type, link: url.toString(), tokenHash, at: Date.now() });
}

const authError = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });

async function authRoute(method, path, query, body, headers) {
  const bearer = (headers.authorization || "").replace(/^Bearer\s+/i, "");
  const claims = verifyJwt(bearer);

  if (method === "POST" && path === "/signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email.includes("@")) return authError(400, "validation_failed", "Unable to validate email address: invalid format");
    if (password.length < 6) return authError(422, "weak_password", "Password should be at least 6 characters.");
    const existing = await getUserByEmail(email);
    if (existing) {
      // GoTrue with email confirmation: obfuscated user without identities, no error.
      const fake = userJson(existing);
      return { status: 200, body: { ...fake, id: randomUUID(), identities: [] } };
    }
    const u = await exclusive(async () => {
      await db.exec("reset role");
      return (await db.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning *", [email, JSON.stringify(body.data || {})])).rows[0];
    });
    passwords.set(u.id, hash(password));
    sendEmail(email, "signup", query.get("redirect_to"), newEmailToken(u.id, "signup"));
    return { status: 200, body: userJson(u) };
  }

  if (method === "POST" && path === "/verify") {
    const t = tokens.get(String(body.token_hash || ""));
    if (!t || t.expires < Date.now()) return authError(403, "otp_expired", "Email link is invalid or has expired");
    tokens.delete(String(body.token_hash));
    let u = await getUser(t.userId);
    if (!u) return authError(403, "otp_expired", "Email link is invalid or has expired");
    if (t.type === "signup" && !u.email_confirmed_at) {
      u = await exclusive(async () => (await db.query("update auth.users set email_confirmed_at = now() where id = $1 returning *", [u.id])).rows[0]);
    }
    return { status: 200, body: issueSession(u) };
  }

  if (method === "POST" && path === "/token") {
    const grant = query.get("grant_type");
    if (grant === "password") {
      const u = await getUserByEmail(String(body.email || ""));
      if (!u || passwords.get(u.id) !== hash(String(body.password || ""))) return authError(400, "invalid_credentials", "Invalid login credentials");
      if (!u.email_confirmed_at) return authError(400, "email_not_confirmed", "Email not confirmed");
      return { status: 200, body: issueSession(u) };
    }
    if (grant === "refresh_token") {
      const rt = refreshTokens.get(String(body.refresh_token || ""));
      if (!rt) return authError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      refreshTokens.delete(String(body.refresh_token));
      const u = await getUser(rt.userId);
      return u ? { status: 200, body: issueSession(u, rt.sessionId) } : authError(400, "refresh_token_not_found", "Invalid Refresh Token");
    }
    return authError(400, "unsupported_grant_type", "unsupported grant type");
  }

  if (path === "/user") {
    if (!claims) return authError(401, "bad_jwt", "invalid JWT");
    const u = await getUser(claims.sub);
    if (!u) return authError(403, "user_not_found", "User from sub claim in JWT does not exist");
    if (method === "GET") return { status: 200, body: userJson(u) };
    if (method === "PUT") {
      if (body.password) {
        if (String(body.password).length < 6) return authError(422, "weak_password", "Password should be at least 6 characters.");
        if (passwords.get(u.id) === hash(String(body.password))) return authError(422, "same_password", "New password should be different from the old password.");
        passwords.set(u.id, hash(String(body.password)));
      }
      return { status: 200, body: userJson(u) };
    }
  }

  if (method === "POST" && path === "/logout") {
    if (claims) {
      const scope = query.get("scope") || "global";
      for (const [k, v] of refreshTokens) {
        if (v.userId !== claims.sub) continue;
        if (scope === "others" && v.sessionId === claims.session_id) continue;
        if (scope === "local" && v.sessionId !== claims.session_id) continue;
        refreshTokens.delete(k);
      }
    }
    return { status: 204, body: null };
  }

  if (method === "POST" && path === "/recover") {
    const u = await getUserByEmail(String(body.email || ""));
    if (u) sendEmail(u.email, "recovery", query.get("redirect_to"), newEmailToken(u.id, "recovery"));
    return { status: 200, body: {} };
  }

  if (method === "POST" && path === "/resend") {
    const u = await getUserByEmail(String(body.email || ""));
    if (u && !u.email_confirmed_at) sendEmail(u.email, "signup", body.options?.email_redirect_to || body.email_redirect_to || query.get("redirect_to"), newEmailToken(u.id, "signup"));
    return { status: 200, body: {} };
  }

  if (method === "GET" && path === "/settings") return { status: 200, body: { external: { email: true }, disable_signup: false, mailer_autoconfirm: false } };
  return authError(404, "not_found", "Not found");
}

// ---------------------------------------------------------------------------------------------
// PostgREST subset
const TABLES = new Set(["profiles", "qr_projects", "qr_history", "user_templates"]);
const RPCS = new Set(["ensure_profile"]);
const IDENT = /^[a-z_][a-z0-9_]*$/;
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike", is: "is" };
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function pgError(e) {
  const code = e.code || "XX000";
  const status = code === "42501" ? 403 : code === "23505" ? 409 : code.startsWith("23") || code.startsWith("22") ? 400 : 400;
  return { status, body: { code, message: e.message, details: null, hint: null } };
}

function buildWhere(query, params) {
  const parts = [];
  for (const [key, raw] of query.entries()) {
    if (RESERVED.has(key)) continue;
    if (!IDENT.test(key)) throw Object.assign(new Error(`bad column ${key}`), { code: "42703" });
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    let value = raw.slice(dot + 1);
    if (!OPS[op]) throw Object.assign(new Error(`unsupported operator ${op}`), { code: "PGRST100" });
    if (op === "is") {
      if (!["null", "true", "false"].includes(value)) throw Object.assign(new Error("bad is value"), { code: "PGRST100" });
      parts.push(`"${key}" is ${value}`);
      continue;
    }
    if (op === "like" || op === "ilike") value = value.replace(/\*/g, "%");
    params.push(value);
    parts.push(`"${key}"::text ${OPS[op]} $${params.length}`);
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

function selectList(query) {
  const s = query.get("select") || "*";
  if (s === "*") return "*";
  const cols = s.split(",").map((c) => c.trim());
  if (!cols.every((c) => IDENT.test(c))) throw Object.assign(new Error("unsupported select"), { code: "PGRST100" });
  return cols.map((c) => `"${c}"`).join(", ");
}

function orderClause(query) {
  const o = query.get("order");
  if (!o) return "";
  const items = o.split(",").map((part) => {
    const [col, dir = "asc"] = part.split(".");
    if (!IDENT.test(col) || !["asc", "desc"].includes(dir)) throw Object.assign(new Error("bad order"), { code: "PGRST100" });
    return `"${col}" ${dir}`;
  });
  return ` order by ${items.join(", ")}`;
}

const toDb = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
const fromDb = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));

async function restRoute(method, table, query, body, headers, claims) {
  const prefer = headers.prefer || "";
  const wantCount = /count=exact/.test(prefer);
  const single = (headers.accept || "").includes("vnd.pgrst.object");
  return asRole(claims, async () => {
    try {
      if (table.startsWith("rpc/")) {
        const fn = table.slice(4);
        if (!RPCS.has(fn)) return { status: 404, body: { code: "PGRST202", message: "function not found" } };
        await db.query(`select public.${fn}()`);
        return { status: 200, body: null };
      }
      if (!TABLES.has(table)) return { status: 404, body: { code: "42P01", message: `relation "${table}" does not exist` } };
      const params = [];
      let rows = [];
      let count = null;
      if (method === "GET" || method === "HEAD") {
        const where = buildWhere(query, params);
        const limit = query.get("limit") ? ` limit ${Number(query.get("limit"))}` : "";
        const offset = query.get("offset") ? ` offset ${Number(query.get("offset"))}` : "";
        if (wantCount) count = Number((await db.query(`select count(*)::int as c from public."${table}"${where}`, params)).rows[0].c);
        if (method === "GET") rows = (await db.query(`select ${selectList(query)} from public."${table}"${where}${orderClause(query)}${limit}${offset}`, params)).rows;
      } else if (method === "POST") {
        const list = Array.isArray(body) ? body : [body];
        const ignore = /resolution=ignore-duplicates/.test(prefer);
        const merge = /resolution=merge-duplicates/.test(prefer);
        const conflict = query.get("on_conflict");
        for (const item of list) {
          const cols = Object.keys(item);
          if (!cols.every((c) => IDENT.test(c))) throw Object.assign(new Error("bad column"), { code: "42703" });
          const p = cols.map((c) => toDb(item[c]));
          let sql = `insert into public."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
          if ((ignore || merge) && conflict && IDENT.test(conflict)) {
            sql += ignore ? ` on conflict ("${conflict}") do nothing` : ` on conflict ("${conflict}") do update set ${cols.filter((c) => c !== conflict).map((c) => `"${c}" = excluded."${c}"`).join(", ")}`;
          }
          rows.push(...(await db.query(`${sql} returning ${selectList(query)}`, p)).rows);
        }
      } else if (method === "PATCH") {
        const cols = Object.keys(body);
        if (!cols.every((c) => IDENT.test(c))) throw Object.assign(new Error("bad column"), { code: "42703" });
        cols.forEach((c) => params.push(toDb(body[c])));
        const set = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
        const where = buildWhere(query, params);
        if (!where) return { status: 400, body: { code: "21000", message: "UPDATE requires a WHERE clause" } };
        rows = (await db.query(`update public."${table}" set ${set}${where} returning ${selectList(query)}`, params)).rows;
        count = rows.length;
      } else if (method === "DELETE") {
        const where = buildWhere(query, params);
        if (!where) return { status: 400, body: { code: "21000", message: "DELETE requires a WHERE clause" } };
        rows = (await db.query(`delete from public."${table}"${where} returning *`, params)).rows;
        count = rows.length;
      }
      rows = rows.map(fromDb);
      const extra = {};
      if (count !== null || wantCount) extra["content-range"] = rows.length ? `0-${rows.length - 1}/${count ?? rows.length}` : `*/${count ?? 0}`;
      if (method === "HEAD") return { status: 200, body: null, headers: extra };
      if (single) {
        if (rows.length !== 1) return { status: 406, body: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows` } };
        return { status: 200, body: rows[0], headers: extra };
      }
      const returnRep = method === "GET" || /return=representation/.test(prefer);
      return { status: method === "POST" ? 201 : 200, body: returnRep ? rows : null, headers: extra };
    } catch (e) {
      return pgError(e);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Storage subset (private bucket objects; authorization via storage.objects RLS)
async function storageRoute(method, path, req, rawBody, headers, claims) {
  const m = /^\/object\/(?:authenticated\/)?([^/]+)\/?(.*)$/.exec(path);
  if (!m) return { status: 404, body: { error: "not_found", message: "Not found" } };
  const bucket = decodeURIComponent(m[1]);
  const name = decodeURIComponent(m[2] || "");
  return asRole(claims, async () => {
    try {
      if (method === "POST" || method === "PUT") {
        let bytes = rawBody;
        let type = headers["content-type"] || "application/octet-stream";
        if (type.startsWith("multipart/form-data")) {
          const form = await new Request("http://x", { method: "POST", headers: { "content-type": type }, body: rawBody }).formData();
          const file = [...form.values()].find((v) => typeof v === "object");
          bytes = Buffer.from(await file.arrayBuffer());
          type = file.type || "application/octet-stream";
        }
        const upsert = headers["x-upsert"] === "true";
        await db.query(
          `insert into storage.objects (bucket_id, name) values ($1, $2) on conflict (bucket_id, name) do ${upsert ? "update set name = excluded.name" : "nothing"}`,
          [bucket, name],
        );
        storageFiles.set(`${bucket}/${name}`, { bytes, type });
        return { status: 200, body: { Key: `${bucket}/${name}`, Id: randomUUID() } };
      }
      if (method === "GET") {
        const visible = (await db.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucket, name])).rows.length > 0;
        const file = storageFiles.get(`${bucket}/${name}`);
        if (!visible || !file) return { status: 400, body: { statusCode: "404", error: "not_found", message: "Object not found" } };
        return { status: 200, raw: file.bytes, headers: { "content-type": file.type } };
      }
      if (method === "DELETE") {
        const body = JSON.parse(rawBody.toString("utf8") || "{}");
        const out = [];
        for (const prefix of body.prefixes || []) {
          const r = await db.query("delete from storage.objects where bucket_id = $1 and name = $2 returning name", [bucket, prefix]);
          for (const row of r.rows) {
            storageFiles.delete(`${bucket}/${row.name}`);
            out.push({ name: row.name, bucket_id: bucket });
          }
        }
        return { status: 200, body: out };
      }
      return { status: 405, body: { message: "method not allowed" } };
    } catch (e) {
      return { status: e.code === "42501" ? 403 : 400, body: { statusCode: e.code === "42501" ? "403" : "400", error: "Unauthorized", message: e.message } };
    }
  });
}

// ---------------------------------------------------------------------------------------------
// HTTP
function cors(req, res) {
  res.setHeader("access-control-allow-origin", req.headers.origin || "*");
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("access-control-expose-headers", "content-range, x-total-count");
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (r) => {
    const headers = { ...(r.headers || {}) };
    if (r.raw) return res.writeHead(r.status, headers).end(r.raw);
    if (r.body === null || r.body === undefined) return res.writeHead(r.status, headers).end();
    res.writeHead(r.status, { "content-type": "application/json", ...headers }).end(JSON.stringify(r.body));
  };
  try {
    const p = url.pathname;
    if (p === "/__test/health") return send({ status: 200, body: { ok: true } });
    if (p === "/__test/outbox") {
      const to = (url.searchParams.get("email") || "").toLowerCase();
      return send({ status: 200, body: outbox.filter((m) => !to || m.to === to) });
    }
    if (p === "/__test/sql" && req.method === "POST") {
      // Superuser query helper for assertions in tests (never part of the app).
      const { sql, params } = JSON.parse(raw.toString("utf8"));
      const r = await exclusive(async () => {
        await db.exec("reset role");
        return db.query(sql, params || []);
      });
      return send({ status: 200, body: r.rows.map(fromDb) });
    }
    const json = () => (raw.length && (req.headers["content-type"] || "").includes("json") ? JSON.parse(raw.toString("utf8")) : {});
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const claims = verifyJwt(bearer);
    if (p.startsWith("/auth/v1/")) return send(await authRoute(req.method, p.slice(8), url.searchParams, json(), req.headers));
    if (p.startsWith("/rest/v1/")) {
      const roleClaims = claims && claims.role === "authenticated" ? claims : { role: "anon" };
      return send(await restRoute(req.method, p.slice(9), url.searchParams, req.method === "GET" || req.method === "HEAD" ? {} : json(), req.headers, roleClaims));
    }
    if (p.startsWith("/storage/v1/")) {
      const roleClaims = claims && claims.role === "authenticated" ? claims : { role: "anon" };
      return send(await storageRoute(req.method, p.slice(11), req, raw, req.headers, roleClaims));
    }
    send({ status: 404, body: { message: "not found" } });
  } catch (e) {
    send({ status: 500, body: { message: e instanceof Error ? e.message : String(e) } });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`));
