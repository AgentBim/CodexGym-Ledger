import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/** Called by the app-level Next.js proxy. Never trust this for authorization;
 * server actions still call requireUser and Postgres still enforces RLS. */
export async function refreshSupabaseSession(request: NextRequest, requestHeaders = new Headers(request.headers)) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

/**
 * Supabase stores browser sessions in a project-scoped cookie. Anonymous
 * requests have nothing to refresh, so sending every page view (including
 * crawlers and link prefetches) through Auth only creates avoidable traffic.
 */
export function hasSupabaseSessionCookie(request: NextRequest, projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!projectUrl) return false;

  let projectRef: string | undefined;
  try {
    projectRef = new URL(projectUrl).hostname.split(".")[0];
  } catch {
    return false;
  }

  if (!projectRef) return false;
  const cookieName = `sb-${projectRef}-auth-token`;
  return request.cookies
    .getAll()
    .some(({ name, value }) => Boolean(value) && (name === cookieName || name.startsWith(`${cookieName}.`)));
}
