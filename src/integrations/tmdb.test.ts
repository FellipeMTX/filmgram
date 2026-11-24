import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDetail, getFeedTitle, getTrending } from "./tmdb";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("TMDB catalog", () => {
  it("filters explicit fixtures by media type and returns missing titles as null", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "1");
    const films = await getTrending("en", "movie");
    expect(films.length).toBeGreaterThanOrEqual(12);
    expect((await getTrending("en", "tv")).length).toBeGreaterThanOrEqual(12);
    expect(films.every((x) => x.media_type === "movie")).toBe(true);
    expect(await getDetail("en", "movie", 999999)).toBeNull();
    expect((await getDetail("en", "movie", 1726))?.poster_path).toBeNull();
  });
  it("skips people and malformed titles in mixed trends", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: 1, media_type: "person", name: "Someone" },
            { id: 2, media_type: "movie", title: "Film" },
            { id: 3, media_type: "tv", name: "Series" },
            { id: 4, media_type: "movie", title: " " },
          ],
        }),
      }),
    );
    expect((await getTrending("en")).map((x) => x.id)).toEqual([2, 3]);
  });
  it("skips malformed upstream results", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: "not a number" }] }),
      }),
    );
    await expect(getTrending("en")).resolves.toEqual([]);
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

it("caches localized feed metadata without requesting credits", async () => {
  vi.stubEnv("FILMGRAM_FIXTURES", "0");
  vi.stubEnv("TMDB_READ_TOKEN", "test");
  const upstream = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 23, title: "Filme" }),
  });
  vi.stubGlobal("fetch", upstream);
  await getFeedTitle("pt-BR", "movie", 23);
  expect(upstream).toHaveBeenCalledWith(
    expect.stringContaining("/movie/23?language=pt-BR"),
    expect.objectContaining({ next: { revalidate: 3600 } }),
  );
  expect(upstream.mock.calls[0]?.[0]).not.toContain("credits");
  vi.unstubAllGlobals();
});
