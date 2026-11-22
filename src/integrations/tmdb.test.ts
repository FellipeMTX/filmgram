import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDetail, getTrending } from "./tmdb";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("TMDB catalog", () => {
  it("filters explicit fixtures by media type and returns missing titles as null", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "1");
    const films = await getTrending("en", "movie");
    expect(films.length).toBeGreaterThan(0);
    expect(films.every((x) => x.media_type === "movie")).toBe(true);
    expect(await getDetail("en", "movie", 999999)).toBeNull();
    expect((await getDetail("en", "movie", 105))?.poster_path).toBeNull();
  });
  it("rejects malformed upstream responses", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: "not a number" }] }),
      }),
    );
    await expect(getTrending("en")).rejects.toThrow();
  });
});

it("revalidates public trends and requests individual details on demand", async () => {
  vi.stubEnv("FILMGRAM_FIXTURES", "0");
  vi.stubEnv("TMDB_READ_TOKEN", "test");
  const upstream = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 23, title: "Glass Tide" }] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 23, title: "Glass Tide" }),
    });
  vi.stubGlobal("fetch", upstream);
  try {
    await getTrending("en", "movie");
    await getDetail("en", "movie", 23);
    expect(upstream).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/trending/movie/day"),
      expect.objectContaining({ next: { revalidate: 600 } }),
    );
    expect(upstream).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/movie/23"),
      expect.objectContaining({ cache: "no-store" }),
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
