import { describe, expect, it } from "vitest";
import { authErrorPath, safeReturnPath } from "./redirects";

describe("OAuth return paths", () => {
  it("preserves allowed localized paths and query parameters", () => {
    expect(safeReturnPath("/pt-BR/title/movie/123?tab=reviews")).toBe(
      "/pt-BR/title/movie/123?tab=reviews",
    );
    expect(
      safeReturnPath("/pt-BR/person/3223?q=Iron&type=movie#person-reviews"),
    ).toBe("/pt-BR/person/3223?q=Iron&type=movie#person-reviews");
    expect(authErrorPath("/es/playlists?x=1")).toBe(
      "/es/playlists?x=1&auth_error=1",
    );
  });
  it.each([
    "//evil.test/en/discover",
    "/\\evil.test/en/discover",
    "/en/../../evil",
    "/en/%2e%2e/%2e%2e/evil",
    "/en/%2f%2fevil.test",
    "https://evil.test/en/discover",
    "/en/discover%0d%0afoo",
    "/en/auth/callback",
    "/en/person/0",
    "/en/person/-1",
    "/en/person/1/extra",
  ])("rejects unsafe return %s", (value) => {
    expect(safeReturnPath(value)).toBe("/en/discover");
  });
});
