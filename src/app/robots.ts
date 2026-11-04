import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Account pages carry no public content (and are inactive in Guest Mode).
        disallow: ["/dashboard", "/auth/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
