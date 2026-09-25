import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getRequestOrigin(request: Request, fallbackOrigin: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return fallbackOrigin;

  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : hostname === "localhost" || hostname === "127.0.0.1"
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request, url.origin);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext === "/update-password" ? requestedNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth/error", origin));
}
