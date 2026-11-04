import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";
import { GUEST_ONLY, isProtected } from "@/lib/auth/redirect";

/**
 * Refreshes the Supabase session cookies on every navigation and performs optimistic redirects.
 * Authorization is still enforced by the dashboard layout (getUser) and by RLS in the database.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!supabaseConfig.ok) {
    if (isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseConfig.config.url, supabaseConfig.config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Validates the JWT (and refreshes it when needed). Network failure ⇒ treated as signed out.
  let userId: string | null = null;
  let verified = false;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as { sub?: string; email_verified?: boolean; user_metadata?: { email_verified?: boolean } } | undefined;
    userId = claims?.sub ?? null;
    verified = Boolean(claims?.email_verified ?? claims?.user_metadata?.email_verified ?? userId);
  } catch {
    userId = null;
  }

  const redirect = (path: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = new URLSearchParams(params).toString();
    const res = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (isProtected(pathname)) {
    if (!userId) return redirect("/login", { next: `${pathname}${search}` });
    if (!verified) return redirect("/verify-email");
  }
  if (userId && verified && (GUEST_ONLY as readonly string[]).includes(pathname)) return redirect("/dashboard");
  return response;
}

export const config = {
  // Everything except static assets and files.
  matcher: ["/((?!_next/static|_next/image|wasm/|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|wasm|txt|xml)$).*)"],
};
