import { expect, test, type Page } from "@playwright/test";
import { encodePngRgba } from "../helpers/png";
import { ANON_KEY, MOCK, apiToken, createVerifiedUser, login, sql } from "./accounts-helpers";

async function expectScans(page: Page) {
  await expect(page.locator("[data-scan]").first()).toHaveAttribute("data-scan", "pass", { timeout: 20_000 });
}

function logoPng(): Buffer {
  const s = 48;
  const rgba = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i++) rgba.set([94, 23, 235, 255], i * 4);
  return Buffer.from(encodePngRgba(s, s, rgba));
}

async function saveWifiProject(page: Page, name: string) {
  await page.goto("/create?type=wifi");
  const form = page.locator("#main form").first();
  await form.locator('[name="ssid"]').fill("Studio Guest");
  await form.locator('[name="password"]').fill("guest-pass-2026");
  await page.getByTestId("pane-logo").locator("summary").click();
  await page.getByTestId("logo-input").setInputFiles({ name: "violet.png", mimeType: "image/png", buffer: logoPng() });
  await expect(page.getByTestId("logo-thumb")).toBeVisible();
  await expectScans(page);
  await page.getByLabel("Project name").fill(name);
  await page.getByTestId("save-project").click();
  await expect(page.getByTestId("save-status")).toHaveText(`Saved “${name}” to your projects.`);
  await expect(page).toHaveURL(/project=[0-9a-f-]{36}/);
  return new URL(page.url()).searchParams.get("project")!;
}

test("projects: save with logo, list, reopen (content + logo), update, conflict, duplicate, search, delete", async ({ page, request, browser }) => {
  const user = await createVerifiedUser(request, "Project Owner");
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/projects");
  await expect(page.getByTestId("projects-empty")).toBeVisible();

  const id = await saveWifiProject(page, "Lobby Wi-Fi");
  const stored = await sql<{ logo_path: string; form_values: Record<string, string>; revision: number }>(request, "select logo_path, form_values, revision from qr_projects where id = $1", [id]);
  expect(stored[0]!.logo_path).toMatch(/^[0-9a-f-]{36}\/projects\/[0-9a-f-]{36}\.png$/);
  expect(stored[0]!.form_values.ssid).toBe("Studio Guest");

  await page.goto("/dashboard/projects");
  const card = page.locator('[data-project="Lobby Wi-Fi"]');
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Open Lobby Wi-Fi" }).click();
  await expect(page.getByTestId("open-status")).toContainText("Opened “Lobby Wi-Fi”");
  await expect(page.locator("#main form").first().locator('[name="ssid"]')).toHaveValue("Studio Guest");
  await expect(page.getByTestId("qr-payload")).toHaveText("WIFI:T:WPA;S:Studio Guest;P:guest-pass-2026;;");
  await expect(page.getByTestId("qr-ec")).toHaveText("H"); // logo restored → auto EC H
  await expectScans(page);

  // Update in place.
  await page.locator("#main form").first().locator('[name="ssid"]').fill("Studio Guest 5G");
  await page.getByTestId("save-project").click();
  await expect(page.getByTestId("save-status")).toHaveText("Updated “Lobby Wi-Fi”.");

  // A second device with the stale revision cannot overwrite newer data.
  const ctx = await browser.newContext({ baseURL: "http://localhost:3101" });
  const stale = await ctx.newPage();
  await login(stale, user.email, user.password);
  await expect(stale).toHaveURL(/\/dashboard$/);
  await stale.goto(`/create?project=${id}`);
  await expect(stale.getByTestId("open-status")).toContainText("Opened");
  await page.locator("#main form").first().locator('[name="ssid"]').fill("Changed on device 1");
  await page.getByTestId("save-project").click();
  await expect(page.getByTestId("save-status")).toHaveText("Updated “Lobby Wi-Fi”.");
  await stale.getByTestId("save-project").click();
  await expect(stale.getByTestId("save-status")).toContainText("changed elsewhere");
  await ctx.close();

  // Duplicate, search, filter.
  await page.goto("/dashboard/projects");
  await page.getByRole("button", { name: "Duplicate Lobby Wi-Fi" }).click();
  await expect(page.getByTestId("projects-status")).toHaveText("Duplicated as “Lobby Wi-Fi (copy)”.");
  await expect(page.locator("[data-project]")).toHaveCount(2);
  await page.getByTestId("project-search").fill("copy");
  await expect(page.locator("[data-project]")).toHaveCount(1);
  await page.getByTestId("project-search").fill("");
  await page.getByTestId("project-type-filter").selectOption("url");
  await expect(page.getByTestId("projects-empty")).toBeVisible();
  await page.getByTestId("project-type-filter").selectOption("");

  // Delete asks for confirmation, removes the row and its logo file.
  await page.getByRole("button", { name: "Delete Lobby Wi-Fi (copy)" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete project?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("[data-project]")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete Lobby Wi-Fi (copy)" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("projects-status")).toHaveText("Deleted “Lobby Wi-Fi (copy)”.");
  await expect(page.locator("[data-project]")).toHaveCount(1);
  const logos = await sql(request, "select name from storage.objects where name like $1", [`%${id}%`]);
  expect(logos).toHaveLength(1); // the original project's logo remains, the copy's was removed
});

test("history: recorded on download/save without content, filter, reopen design, delete, clear", async ({ page, request }) => {
  const user = await createVerifiedUser(request, "History Owner");
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/create?template=sunset");
  const form = page.locator("#main form").first();
  await form.locator('[name="url"]').fill("example.com/menu");
  await expectScans(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);

  await page.goto("/create?type=wifi");
  await form.locator('[name="ssid"]').fill("SecretHomeNet");
  await form.locator('[name="password"]').fill("very-secret-pw-1");
  await expectScans(page);
  await page.getByRole("radio", { name: "SVG", exact: true }).click();
  await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);

  // Nothing secret is stored in history.
  await expect.poll(async () => (await sql(request, "select h.* from qr_history h join auth.users u on u.id = h.user_id where u.email = $1", [user.email])).length).toBe(2);
  const rows = await sql<Record<string, unknown>>(request, "select h.* from qr_history h join auth.users u on u.id = h.user_id where u.email = $1", [user.email]);
  const dump = JSON.stringify(rows);
  expect(dump).not.toContain("SecretHomeNet");
  expect(dump).not.toContain("very-secret-pw-1");
  expect(dump).toContain("Website · example.com");

  await page.goto("/dashboard/history");
  await expect(page.locator("[data-history]")).toHaveCount(2);
  await page.getByTestId("history-type-filter").selectOption("wifi");
  await expect(page.locator("[data-history]")).toHaveCount(1);
  await expect(page.locator("[data-history]")).toContainText("Wi-Fi");
  await page.getByTestId("history-type-filter").selectOption("");

  // Reopen the design of the website download (content isn't stored).
  await page.getByRole("link", { name: "Reopen Website · example.com" }).click();
  await expect(page.getByTestId("open-status")).toContainText("Reopened the design");
  await page.locator("#main form").first().locator('[name="url"]').fill("example.com");
  await expect.poll(async () => decodeURIComponent((await page.getByTestId("qr-preview").getAttribute("src"))!)).toContain("<radialGradient");

  await page.goto("/dashboard/history");
  await page.getByRole("button", { name: "Delete history entry Wi-Fi" }).click();
  await expect(page.getByTestId("history-status")).toHaveText("History entry deleted.");
  await expect(page.locator("[data-history]")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear history" }).click();
  await page.getByRole("dialog", { name: "Clear all history?" }).getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByTestId("history-empty")).toBeVisible();

  // Overview reflects activity.
  await page.goto("/dashboard");
  await expect(page.getByTestId("stat-history")).toContainText("0");
});

test("templates: device templates upload to the account, sync to another device, conflicts, delete", async ({ page, request, browser }) => {
  const user = await createVerifiedUser(request, "Template Owner");

  // Signed out: template saved on this device.
  await page.goto("/create");
  await page.getByTestId("pane-templates").locator("summary").click();
  await expect(page.getByTestId("sync-state")).toContainText("Saved on this device");
  await page.getByTestId("builtin-templates").locator('[data-template="ocean"]').click();
  await page.getByLabel("Template name").fill("Device template");
  await page.getByRole("button", { name: "Save current design" }).click();
  await expect(page.getByTestId("template-status")).toContainText("Saved “Device template” on this device.");

  // Log in on the same browser: the device template is offered for upload, never deleted.
  await login(page, user.email, user.password, "/dashboard/templates");
  await expect(page).toHaveURL(/\/dashboard\/templates$/);
  const list = page.getByTestId("dashboard-templates");
  await expect(list.locator('[data-user-template="Device template"][data-source="local"]')).toBeVisible();
  await list.getByTestId("upload-local").click();
  await expect(list.getByTestId("template-status")).toContainText("Uploaded 1 template to your account. The copies on this device were kept.");
  await expect(list.locator('[data-user-template="Device template"][data-source="cloud"]')).toBeVisible();
  await expect(list.locator('[data-user-template="Device template"][data-source="local"]')).toContainText("also in account");

  // Signed-in saves go straight to the account.
  await page.goto("/create");
  await page.getByTestId("pane-templates").locator("summary").click();
  await expect(page.getByTestId("sync-state")).toContainText("sync to your account");
  await page.getByTestId("builtin-templates").locator('[data-template="berry"]').click();
  await page.getByLabel("Template name").fill("Cloud template");
  await page.getByRole("button", { name: "Save current design" }).click();
  await expect(page.getByTestId("template-status")).toContainText("Saved “Cloud template” to your account.");

  // Another device (fresh browser profile, empty IndexedDB) sees both cloud templates.
  const ctx = await browser.newContext({ baseURL: "http://localhost:3101" });
  const other = await ctx.newPage();
  await login(other, user.email, user.password, "/dashboard/templates");
  const otherList = other.getByTestId("dashboard-templates");
  await expect(otherList.locator('[data-user-template][data-source="cloud"]')).toHaveCount(2);
  await expect(otherList.locator('[data-user-template][data-source="local"]')).toHaveCount(0);

  // Apply a cloud template in the studio on the other device.
  await other.getByRole("link", { name: "Open Cloud template in the studio" }).click();
  await expect(other.getByTestId("open-status")).toContainText("Applied your template “Cloud template”");
  await expect(other.getByTestId("builtin-templates").locator('[data-template="berry"]')).toHaveAttribute("aria-pressed", "true");

  // Rename on device 2, then a stale rename on device 1 is rejected.
  await other.goto("/dashboard/templates");
  await otherList.getByRole("button", { name: "Rename Cloud template" }).first().click();
  await otherList.getByLabel("New name for Cloud template").fill("Renamed elsewhere");
  await otherList.getByRole("button", { name: "Save name" }).click();
  await expect(otherList.locator('[data-user-template="Renamed elsewhere"]')).toBeVisible();

  await page.goto("/dashboard/templates"); // loaded before? no — load now, then rename via stale state below
  await expect(list.locator('[data-user-template="Renamed elsewhere"]')).toBeVisible();
  await other.goto("/dashboard/templates");
  await otherList.getByRole("button", { name: "Rename Renamed elsewhere" }).click();
  await otherList.getByLabel("New name for Renamed elsewhere").fill("Newest name");
  await otherList.getByRole("button", { name: "Save name" }).click();
  await expect(otherList.locator('[data-user-template="Newest name"]')).toBeVisible();
  // Device 1 still shows the old revision.
  await list.getByRole("button", { name: "Rename Renamed elsewhere" }).click();
  await list.getByLabel("New name for Renamed elsewhere").fill("Stale overwrite");
  await list.getByRole("button", { name: "Save name" }).click();
  await expect(list.getByTestId("template-status")).toContainText("changed on another device");
  await expect(list.locator('[data-user-template="Newest name"]')).toBeVisible();

  // Delete a cloud template: gone on every device; the device copy of the other one stays.
  await otherList.getByRole("button", { name: "Delete Newest name" }).click();
  await other.getByRole("dialog", { name: "Delete template?" }).getByRole("button", { name: "Delete" }).click();
  await expect(otherList.locator('[data-user-template][data-source="cloud"]')).toHaveCount(1);
  await ctx.close();
  await page.reload();
  await expect(list.locator('[data-user-template][data-source="cloud"]')).toHaveCount(1);
  await expect(list.locator('[data-user-template="Device template"][data-source="local"]')).toBeVisible();
});

test("profile: update own profile; email and id cannot be changed", async ({ page, request }) => {
  const user = await createVerifiedUser(request, "Profile Owner");
  await login(page, user.email, user.password, "/dashboard/settings");
  await expect(page.getByTestId("account-email")).toHaveText(user.email);
  const form = page.getByTestId("profile-form");
  await form.getByLabel("Full name").fill("Profile Owner Renamed");
  await form.getByLabel("Company").fill("Virhino Labs");
  await form.getByLabel("Avatar image link").fill("javascript:alert(1)");
  await form.getByRole("button", { name: "Save profile" }).click();
  await expect(form.getByText("Use an https:// image link")).toBeVisible();
  await form.getByLabel("Avatar image link").fill("https://example.com/avatar.png");
  await form.getByRole("button", { name: "Save profile" }).click();
  await expect(form.getByTestId("form-message")).toHaveText("Profile saved.");
  await page.reload();
  await expect(page.getByTestId("dashboard-greeting")).toContainText("Profile Owner Renamed");

  const token = await apiToken(request, user.email, user.password);
  const headers = { apikey: ANON_KEY, authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" };
  const uid = (await sql<{ id: string }>(request, "select id from auth.users where email = $1", [user.email]))[0]!.id;
  const r = await request.patch(`${MOCK}/rest/v1/profiles?id=eq.${uid}`, { headers, data: { email: "evil@example.com" } });
  expect(r.status()).toBe(403);
});

test("user isolation: User B cannot see or change User A's data — via the UI or the API directly", async ({ page, request, browser }) => {
  const a = await createVerifiedUser(request, "User A");
  const b = await createVerifiedUser(request, "User B");

  await login(page, a.email, a.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  const projectA = await saveWifiProject(page, "A private project");
  const aId = (await sql<{ id: string }>(request, "select id from auth.users where email = $1", [a.email]))[0]!.id;
  const logoA = (await sql<{ logo_path: string }>(request, "select logo_path from qr_projects where id = $1", [projectA]))[0]!.logo_path;

  // UI: B's dashboard is empty and A's project id doesn't open.
  const ctx = await browser.newContext({ baseURL: "http://localhost:3101" });
  const pb = await ctx.newPage();
  await login(pb, b.email, b.password, "/dashboard/projects");
  await expect(pb.getByTestId("projects-empty")).toBeVisible();
  await pb.goto(`/create?project=${projectA}`);
  await expect(pb.getByTestId("open-status")).toHaveText("This project doesn't exist or isn't yours.");
  await ctx.close();

  // API: B uses a valid token of their own and targets A's rows directly.
  const tokenB = await apiToken(request, b.email, b.password);
  const hB = { apikey: ANON_KEY, authorization: `Bearer ${tokenB}`, "content-type": "application/json", prefer: "return=representation" };
  const read = await request.get(`${MOCK}/rest/v1/qr_projects?select=*&id=eq.${projectA}`, { headers: hB });
  expect(await read.json()).toEqual([]);
  const upd = await request.patch(`${MOCK}/rest/v1/qr_projects?id=eq.${projectA}`, { headers: hB, data: { name: "pwned" } });
  expect(await upd.json()).toEqual([]);
  const del = await request.delete(`${MOCK}/rest/v1/qr_projects?id=eq.${projectA}`, { headers: hB });
  expect(await del.json()).toEqual([]);
  const steal = await request.post(`${MOCK}/rest/v1/qr_projects`, { headers: hB, data: { user_id: aId, name: "planted", content_type: "url", design: {} } });
  expect(steal.status()).toBe(403);
  const profiles = await request.get(`${MOCK}/rest/v1/profiles?select=*`, { headers: hB });
  expect(((await profiles.json()) as Array<{ id: string }>).map((p) => p.id)).not.toContain(aId);
  const hist = await request.get(`${MOCK}/rest/v1/qr_history?select=*&user_id=eq.${aId}`, { headers: hB });
  expect(await hist.json()).toEqual([]);
  const logo = await request.get(`${MOCK}/storage/v1/object/authenticated/user-logos/${logoA}`, { headers: hB });
  expect(logo.ok()).toBe(false);
  const upload = await request.post(`${MOCK}/storage/v1/object/user-logos/${aId}/projects/evil.png`, { headers: { ...hB, "content-type": "image/png" }, data: logoPng() });
  expect(upload.ok()).toBe(false);

  // Anonymous (publishable key only) gets nothing.
  const anon = await request.get(`${MOCK}/rest/v1/qr_projects?select=*`, { headers: { apikey: ANON_KEY } });
  expect(anon.status()).toBe(403);

  // A's data is intact.
  expect((await sql<{ name: string }>(request, "select name from qr_projects where id = $1", [projectA]))[0]!.name).toBe("A private project");
  // A can read their own logo through the API.
  const tokenA = await apiToken(request, a.email, a.password);
  const own = await request.get(`${MOCK}/storage/v1/object/authenticated/user-logos/${logoA}`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${tokenA}` } });
  expect(own.ok()).toBe(true);
});

test("bulk ZIP download is recorded in history for signed-in users", async ({ page, request }) => {
  const user = await createVerifiedUser(request, "Bulk Owner");
  await login(page, user.email, user.password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/bulk");
  await page.getByTestId("bulk-input").setInputFiles({ name: "codes.csv", mimeType: "text/csv", buffer: Buffer.from("url\nexample.com\nexample.org\n") });
  await page.getByLabel("Size", { exact: true }).fill("256");
  await page.getByTestId("bulk-generate").click();
  await expect(page.getByTestId("bulk-result-text")).toContainText("2 of 2 codes generated");
  await Promise.all([page.waitForEvent("download"), page.getByTestId("bulk-zip").click()]);
  await page.goto("/dashboard/history");
  await expect(page.locator('[data-history^="Bulk · 2 codes · codes.csv"]')).toBeVisible();
});
