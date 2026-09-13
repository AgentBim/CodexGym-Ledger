import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hasSupabaseSessionCookie } from "./proxy";

const projectUrl = "https://mevsairosejypqqtfnum.supabase.co";

function requestWithCookie(cookie?: string) {
  return new NextRequest("https://chalktab.example/", cookie ? { headers: { cookie } } : undefined);
}

describe("hasSupabaseSessionCookie", () => {
  it("returns false for an anonymous request", () => {
    expect(hasSupabaseSessionCookie(requestWithCookie(), projectUrl)).toBe(false);
  });

  it("recognizes an unchunked project session cookie", () => {
    expect(
      hasSupabaseSessionCookie(
        requestWithCookie("sb-mevsairosejypqqtfnum-auth-token=session"),
        projectUrl,
      ),
    ).toBe(true);
  });

  it("recognizes a chunked project session cookie", () => {
    expect(
      hasSupabaseSessionCookie(
        requestWithCookie("sb-mevsairosejypqqtfnum-auth-token.0=chunk"),
        projectUrl,
      ),
    ).toBe(true);
  });

  it("ignores an empty project session cookie", () => {
    expect(
      hasSupabaseSessionCookie(requestWithCookie("sb-mevsairosejypqqtfnum-auth-token="), projectUrl),
    ).toBe(false);
  });

  it("returns false for a malformed project URL", () => {
    expect(
      hasSupabaseSessionCookie(
        requestWithCookie("sb-mevsairosejypqqtfnum-auth-token=session"),
        "not a URL",
      ),
    ).toBe(false);
  });

  it("ignores another project's session cookie", () => {
    expect(
      hasSupabaseSessionCookie(requestWithCookie("sb-anotherproject-auth-token=session"), projectUrl),
    ).toBe(false);
  });
});
