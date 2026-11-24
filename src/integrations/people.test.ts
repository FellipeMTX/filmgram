import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDetail, getPersonDetails, TmdbError } from "./tmdb";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TMDB people", () => {
  it("provides real fixture credits for a director who also acts", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "1");
    const person = await getPersonDetails("en", 15277);
    const iron = person?.works.find(
      (work) => work.media_type === "movie" && work.id === 1726,
    );
    expect(person?.name).toBe("Jon Favreau");
    expect(iron).toMatchObject({
      acting: true,
      directing: true,
      characters: ["Hogan"],
    });
    expect(iron?.jobs).toContain("Director");
    expect((await getDetail("en", "movie", 1726))?.credits?.crew).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 15277, job: "Director" }),
      ]),
    );
    const pagination = await getPersonDetails("en", 90000001);
    expect(pagination).toMatchObject({
      name: "Filmgram pagination fixture",
      profile_path: null,
    });
    expect(pagination?.works).toHaveLength(25);
    expect(await getPersonDetails("en", 999999999)).toBeNull();
  });

  it("requests combined credits once, caches them, and preserves optional person fields", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    const upstream = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 7,
        name: "Example",
        biography: null,
        birthday: null,
        also_known_as: ["Alias"],
        combined_credits: { cast: [], crew: [] },
      }),
    });
    vi.stubGlobal("fetch", upstream);
    const person = await getPersonDetails("pt-BR", 7);
    expect(person).toMatchObject({
      biography: null,
      also_known_as: ["Alias"],
      works: [],
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream).toHaveBeenCalledWith(
      expect.stringContaining(
        "/person/7?append_to_response=combined_credits&language=pt-BR",
      ),
      expect.objectContaining({ next: { revalidate: 3600 } }),
    );
  });

  it("returns null only on actual HTTP 404 and propagates other errors", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    const upstream = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error("network 404 text"))
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockRejectedValueOnce(new Error("network 404 text"));
    vi.stubGlobal("fetch", upstream);
    expect(await getPersonDetails("en", 1)).toBeNull();
    await expect(getPersonDetails("en", 1)).rejects.toMatchObject({
      status: 500,
    });
    await expect(getPersonDetails("en", 1)).rejects.toThrow("network 404 text");
    expect(await getDetail("en", "movie", 1)).toBeNull();
    await expect(getDetail("en", "movie", 1)).rejects.toThrow(
      "network 404 text",
    );
    expect(new TmdbError(500).status).toBe(500);
  });

  it("propagates malformed person payload errors", async () => {
    vi.stubEnv("FILMGRAM_FIXTURES", "0");
    vi.stubEnv("TMDB_READ_TOKEN", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, name: null }),
      }),
    );
    await expect(getPersonDetails("en", 1)).rejects.toThrow();
  });
});
