import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("internal missing route", () => {
  it("clears a forged internal header on direct requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    try {
      const response = await proxy(
        new NextRequest("http://localhost/en/missing", {
          headers: { "x-filmgram-internal-missing": "1" },
        }),
      );
      expect(
        response.headers.get(
          "x-middleware-request-x-filmgram-internal-missing",
        ),
      ).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("marks internal rewrites and preserves 404 and noindex", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/en/playlists/not-a-uuid"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(
      response.headers.get("x-middleware-request-x-filmgram-internal-missing"),
    ).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/en/missing?playlist=1",
    );
  });
});
