import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const MOCK = "http://127.0.0.1:54400";
export const ANON_KEY = "sb_publishable_e2e_mock_key_0123456789";

let counter = 0;
export function uniqueEmail(tag: string) {
  counter++;
  return `${tag}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}@example.test`;
}

export async function latestEmail(request: APIRequestContext, email: string, type?: string) {
  let found: { link: string; type: string } | undefined;
  await expect
    .poll(async () => {
      const list = (await (await request.get(`${MOCK}/__test/outbox?email=${encodeURIComponent(email)}`)).json()) as Array<{ link: string; type: string }>;
      found = list.filter((m) => !type || m.type === type).at(-1);
      return Boolean(found);
    })
    .toBe(true);
  return found!;
}

/** Creates and verifies a user directly against the emulator's auth API (fast path for setup). */
export async function createVerifiedUser(request: APIRequestContext, name: string, password = "correct-horse-42") {
  const email = uniqueEmail(name.toLowerCase().replace(/\W+/g, "-"));
  const r = await request.post(`${MOCK}/auth/v1/signup?redirect_to=${encodeURIComponent("http://localhost:3101/auth/callback?next=/dashboard")}`, {
    data: { email, password, data: { full_name: name } },
    headers: { apikey: ANON_KEY },
  });
  expect(r.ok()).toBe(true);
  const mail = await latestEmail(request, email, "signup");
  const token = new URL(mail.link).searchParams.get("token_hash");
  const v = await request.post(`${MOCK}/auth/v1/verify`, { data: { type: "email", token_hash: token }, headers: { apikey: ANON_KEY } });
  expect(v.ok()).toBe(true);
  return { email, password, name };
}

/** Logs in through the real login form (sets the SSR session cookies). */
export async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // A cold server under parallel load can take a while for the first server action:
  // wait for either the redirect away from /login or the form's error message.
  await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.getByTestId("form-message").waitFor({ timeout: 45_000 }),
  ]).catch(() => undefined);
}

/** Access token for direct API calls (as an attacker with a valid account would have). */
export async function apiToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const r = await request.post(`${MOCK}/auth/v1/token?grant_type=password`, { data: { email, password }, headers: { apikey: ANON_KEY } });
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { access_token: string }).access_token;
}

export async function sql<T = Record<string, unknown>>(request: APIRequestContext, query: string, params: unknown[] = []): Promise<T[]> {
  const r = await request.post(`${MOCK}/__test/sql`, { data: { sql: query, params } });
  return (await r.json()) as T[];
}
