import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig, warnIfMisconfigured } from "./config";

/**
 * Per-request server client bound to the request cookies (publishable key + the user's session).
 * Returns null when accounts are not configured. Never uses a service-role key.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  warnIfMisconfigured();
  if (!supabaseConfig.ok) return null;
  const store = await cookies();
  return createServerClient(supabaseConfig.config.url, supabaseConfig.config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

/** Verified current user (validated with the Auth server, never trusted from the cookie alone). */
export async function getSessionUser(): Promise<{ supabase: SupabaseClient; user: SessionUser } | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  return {
    supabase,
    user: {
      id: u.id,
      email: u.email ?? "",
      emailVerified: Boolean(u.email_confirmed_at),
      fullName: typeof u.user_metadata?.full_name === "string" ? u.user_metadata.full_name : "",
    },
  };
}
