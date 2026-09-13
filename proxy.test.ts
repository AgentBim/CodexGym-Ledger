import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./src/lib/supabase/proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./src/lib/supabase/proxy")>();
  return {
    ...actual,
    refreshSupabaseSession: vi.fn(
      async (_request: NextRequest, requestHeaders: Headers) =>
        NextResponse.next({ request: { headers: requestHeaders } }),
    ),
  };
});

import { proxy } from "./proxy";
import { refreshSupabaseSession } from "./src/lib/supabase/proxy";

const projectUrl = "https://mevsairosejypqqtfnum.supabase.co";

function requestWithCookie(cookie?: string) {
  return new NextRequest("https://chalktab.example/", cookie ? { headers: { cookie } } : undefined);
}

describe("app proxy session refresh guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = projectUrl;
  });

  it.each([
    ["anonymous", undefined],
    ["empty", "sb-mevsairosejypqqtfnum-auth-token="],
    ["other project", "sb-anotherproject-auth-token=session"],
  ])("does not refresh for %s requests and preserves CSP forwarding", async (_label, cookie) => {
    const response = await proxy(requestWithCookie(cookie));

    expect(refreshSupabaseSession).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    expect(response.headers.get("x-middleware-request-content-security-policy")).toContain("default-src 'self'");
  });

  it("does not refresh when the configured project URL is malformed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not a URL";

    await proxy(requestWithCookie("sb-mevsairosejypqqtfnum-auth-token=session"));

    expect(refreshSupabaseSession).not.toHaveBeenCalled();
  });

  it.each([
    ["unchunked", "sb-mevsairosejypqqtfnum-auth-token=session"],
    ["chunked", "sb-mevsairosejypqqtfnum-auth-token.0=chunk"],
  ])("refreshes for a valid %s project session cookie", async (_label, cookie) => {
    const response = await proxy(requestWithCookie(cookie));

    expect(refreshSupabaseSession).toHaveBeenCalledOnce();
    const forwardedHeaders = vi.mocked(refreshSupabaseSession).mock.calls[0]?.[1];
    expect(forwardedHeaders?.get("x-nonce")).toBeTruthy();
    expect(forwardedHeaders?.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });
});
