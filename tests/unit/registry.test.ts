import { describe, expect, it } from "vitest";
import { CONTENT_TYPES, buildPayload } from "@/lib/payloads";

describe("content type registry", () => {
  it("has exactly 22 unique types", () => {
    expect(CONTENT_TYPES).toHaveLength(22);
    expect(new Set(CONTENT_TYPES.map((t) => t.id)).size).toBe(22);
  });

  it.each(CONTENT_TYPES.map((t) => [t.id, t] as const))("%s: sample is valid and encodes", (_id, type) => {
    const result = buildPayload(type, type.sample);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.payload.length).toBeGreaterThan(0);
  });

  it.each(CONTENT_TYPES.map((t) => [t.id, t] as const))("%s: defaults are reported as empty", (_id, type) => {
    expect(buildPayload(type, type.defaults).status).toBe("empty");
  });

  it("linked (hosted-content) types explain what needs a backend", () => {
    for (const t of CONTENT_TYPES.filter((c) => c.tier === "linked")) expect(t.hostingNote).toMatch(/dynamic tier/);
  });
});
