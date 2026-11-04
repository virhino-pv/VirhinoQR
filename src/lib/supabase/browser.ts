"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | null = null;

/** Browser client (publishable key; the session lives in cookies shared with the server). */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseConfig.ok) return null;
  client ??= createBrowserClient(supabaseConfig.config.url, supabaseConfig.config.publishableKey);
  return client;
}
