import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/create`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}/templates`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/bulk`, changeFrequency: "monthly", priority: 0.7 },
  ];
}
