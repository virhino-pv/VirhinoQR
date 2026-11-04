import { z } from "zod";

/**
 * Public, non-secret configuration. M0–M6 run entirely in the browser, so no server secrets exist;
 * anything secret added later must NOT use the NEXT_PUBLIC_ prefix.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const parsed = schema.safeParse({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined });

export const env = parsed.success ? parsed.data : schema.parse({});
