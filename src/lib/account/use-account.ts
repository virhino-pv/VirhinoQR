"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../supabase/browser";

export type AccountState =
  | { status: "disabled" }
  | { status: "loading" }
  | { status: "signed-out"; supabase: SupabaseClient }
  | { status: "signed-in"; supabase: SupabaseClient; user: { id: string; email: string; verified: boolean } };

/** Follows the Supabase session in the browser. "disabled" when accounts aren't configured. */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>(() => (getBrowserSupabase() ? { status: "loading" } : { status: "disabled" }));
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let active = true;
    const apply = (u: { id: string; email?: string; email_confirmed_at?: string | null } | null | undefined) => {
      if (!active) return;
      setState(u ? { status: "signed-in", supabase: sb, user: { id: u.id, email: u.email ?? "", verified: Boolean(u.email_confirmed_at) } } : { status: "signed-out", supabase: sb });
    };
    sb.auth
      .getUser()
      .then(({ data }) => apply(data.user))
      .catch(() => apply(null));
    const { data } = sb.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}
