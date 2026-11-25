import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  getDetail,
  getFeedTitle,
  getTrending,
  getMovieReleases,
  getMovieVideos,
  getMovieWatchProviders,
  getMovieReleaseCountries,
  getMovieProviderCountries,
} from "./tmdb";
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

describe("TMDB movie supplements", () => {
  function mock(response: unknown) {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => response,
      }),
    );
  }

  it("retains useful production metadata when another optional entry is malformed", async () => {
    mock({
      id: 1726,
      title: "Iron Man",
      budget: null,
      production_companies: [
        { id: 420, name: "Marvel Studios", logo_path: null },
        { id: "not-a-number", name: "Not a company" },
      ],
    });
    expect(await getDetail("en", "movie", 1726)).toMatchObject({
      budget: undefined,
      production_companies: [{ id: 420, name: "Marvel Studios" }],
    });
  });

  it("normalizes valid releases for the requested country independently of locale", async () => {
    const good = {
      release_date: "2008-05-02T00:00:00.000Z",
      type: 3,
      certification: "PG-13",
    };
    mock({
      results: [
        {
          iso_3166_1: "BR",
          release_dates: [
            { release_date: "2008-04-30", type: 3, certification: "12" },
          ],
        },
        {
          iso_3166_1: "US",
          release_dates: [good, good, { release_date: "invalid", type: 3 }],
        },
      ],
    });
    expect(await getMovieReleases("pt-BR", 1726, "us")).toEqual([
      { date: "2008-05-02", type: 3, certification: "PG-13" },
    ]);
    expect(await getMovieReleases("pt-BR", 1726, "PT")).toEqual([]);
  });

  it("uses the highest-ranked valid YouTube entry for duplicated video keys", async () => {
    const common = {
      name: "Clip",
      type: "Trailer",
      key: "8ugaeA-nMTc",
      site: "YouTube",
    };
    mock({
      results: [
        { ...common, id: "older", official: false },
        { ...common, id: "official", official: true },
        { ...common, id: "invalid", key: "invalid" },
        { ...common, id: "other-site", site: "Vimeo", key: "01234567890" },
      ],
    });
    expect((await getMovieVideos("en", 1726)).map((item) => item.id)).toEqual([
      "official",
    ]);
  });

  it("prefers an official trailer in the page language and loads English fallback", async () => {
    const video = {
      key: "8ugaeA-nMTc",
      name: "Video",
      site: "YouTube",
      official: true,
    };
    mock({
      results: [
        {
          ...video,
          id: "clip",
          type: "Clip",
          iso_639_1: "pt",
          key: "01234567890",
        },
        {
          ...video,
          id: "english",
          type: "Trailer",
          iso_639_1: "en",
          key: "abcdefghijk",
        },
        { ...video, id: "portuguese", type: "Trailer", iso_639_1: "pt" },
      ],
    });
    const result = await getMovieVideos("pt-BR", 1726);
    expect(result.map((item) => item.id)).toEqual([
      "portuguese",
      "english",
      "clip",
    ]);
    expect(result[0]?.iso_639_1).toBe("pt");
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes("language=en")),
    ).toBe(true);
  });

  it("keeps videos when one language fails and reports failure when none are usable", async () => {
    mock({});
    const video = {
      id: "fallback",
      key: "8ugaeA-nMTc",
      name: "Trailer",
      type: "Trailer",
      site: "YouTube",
      iso_639_1: "en",
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [video] }),
    } as Response);
    expect(
      (await getMovieVideos("pt-BR", 1726)).map((item) => item.id),
    ).toEqual(["fallback"]);
    fetchMock.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);
    await expect(getMovieVideos("pt-BR", 1726)).rejects.toThrow("failed");
  });
  it("lists only valid countries with release rows or provider offers", async () => {
    const validRelease = { release_date: "2008-05-02", type: 3 };
    mock({
      results: [
        { iso_3166_1: "AU", release_dates: [validRelease] },
        { iso_3166_1: "US", release_dates: [validRelease] },
        { iso_3166_1: "US", release_dates: [validRelease] },
        { iso_3166_1: "BR", release_dates: [{ ...validRelease, type: 7 }] },
        { iso_3166_1: "xyz", release_dates: [validRelease] },
      ],
    });
    expect(await getMovieReleaseCountries("en", 1726)).toEqual(["AU", "US"]);
    const validProvider = { provider_id: 7, provider_name: "Example Provider" };
    mock({
      results: {
        PT: { free: [validProvider] },
        BR: { rent: [validProvider] },
        GB: { rent: [{ ...validProvider, provider_name: "" }] },
        XYZ: { free: [validProvider] },
      },
    });
    expect(await getMovieProviderCountries("en", 1726)).toEqual(["BR", "PT"]);
  });

  it("groups only the requested region and omits untrusted provider links", async () => {
    mock({
      results: {
        US: {
          link: "https://www.themoviedb.org.fake.example/watch",
          rent: [
            { provider_id: 2, provider_name: "Apple TV" },
            { provider_id: 3, provider_name: "" },
          ],
        },
      },
    });
    expect(await getMovieWatchProviders("pt-BR", 1726, "US")).toMatchObject({
      region: "US",
      link: null,
      rent: [{ provider_id: 2, provider_name: "Apple TV" }],
      flatrate: [],
    });
    expect(await getMovieWatchProviders("pt-BR", 1726)).toBeNull();
  });
});
