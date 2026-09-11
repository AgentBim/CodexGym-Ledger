import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hasSupabaseSessionCookie } from "./proxy";

const projectUrl = "https://mevsairosejypqqtfnum.supabase.co";

describe("hasSupabaseSessionCookie", () => {
  it("keeps anonymous requests off the Supabase Auth API", () => {
    const request = new NextRequest("https://gym-ledger.example/");

    expect(hasSupabaseSessionCookie(request, projectUrl)).toBe(false);
  });

  it("recognizes an unchunked session cookie", () => {
    const request = new NextRequest("https://gym-ledger.example/", {
      headers: { cookie: "sb-mevsairosejypqqtfnum-auth-token=session" },
    });

    expect(hasSupabaseSessionCookie(request, projectUrl)).toBe(true);
  });

  it("recognizes Supabase's chunked session cookies", () => {
    const request = new NextRequest("https://gym-ledger.example/", {
      headers: { cookie: "sb-mevsairosejypqqtfnum-auth-token.0=chunk" },
    });

    expect(hasSupabaseSessionCookie(request, projectUrl)).toBe(true);
  });

  it("ignores cookies belonging to another Supabase project", () => {
    const request = new NextRequest("https://gym-ledger.example/", {
      headers: { cookie: "sb-anotherproject-auth-token=session" },
    });

    expect(hasSupabaseSessionCookie(request, projectUrl)).toBe(false);
  });
});
