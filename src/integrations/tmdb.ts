import { z } from "zod";
import "server-only";
import { cache } from "react";
import fixtureData from "./fixtures.json";
import peopleFixtureData from "./people-fixtures.json";
import { normalizePersonWorks } from "@/features/people/filmography";
import type { PersonWork } from "@/features/people/filmography";
export type MediaType = "movie" | "tv";
const itemSchema = z.object({
  id: z.number(),
  media_type: z.enum(["movie", "tv"]).optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  vote_average: z.number().optional(),
  genre_ids: z.array(z.number()).optional(),
});
function validItems<T extends z.ZodType>(schema: T) {
  return z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const parsed = schema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }),
  );
}
const namedItem = z.string().trim().min(1);
const positiveId = z.number().int().positive();
const companySchema = z.object({
  id: positiveId,
  name: namedItem,
  logo_path: z.string().nullable().optional(),
  origin_country: z.string().optional(),
});
const countrySchema = z.object({ iso_3166_1: z.string(), name: namedItem });
const languageSchema = z.object({
  iso_639_1: z.string(),
  name: z.string(),
  english_name: z.string().optional(),
});
const detailSchema = itemSchema.extend({
  production_companies: validItems(companySchema).optional().catch(undefined),
  production_countries: validItems(countrySchema).optional().catch(undefined),
  spoken_languages: validItems(languageSchema).optional().catch(undefined),
  original_language: z.string().optional().catch(undefined),
  original_title: z.string().optional().catch(undefined),
  budget: z.number().nonnegative().optional().catch(undefined),
  revenue: z.number().nonnegative().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  tagline: z.string().nullable().optional().catch(undefined),
  genres: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
  runtime: z.number().nullable().optional(),
  episode_run_time: z.array(z.number()).optional(),
  credits: z
    .object({
      cast: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          character: z.string().optional(),
          profile_path: z.string().nullable().optional(),
        }),
      ),
      crew: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            job: z.string(),
            department: z.string().optional().catch(undefined),
            profile_path: z.string().nullable().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type Title = z.infer<typeof detailSchema> & { media_type: MediaType };
const fixtures: Title[] = fixtureData as Title[];
export { titleName, year, imageUrl } from "./tmdb-display";
export class TmdbError extends Error {
  constructor(readonly status: number) {
    super("TMDB request failed: " + status);
    this.name = "TmdbError";
  }
}
async function request(path: string, locale: string, revalidate?: number) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN is not configured");
  const response = await fetch(
    `https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}language=${encodeURIComponent(locale)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      ...(revalidate === undefined
        ? { cache: "no-store" }
        : { next: { revalidate } }),
    },
  );
  if (!response.ok) throw new TmdbError(response.status);
  return response.json() as Promise<unknown>;
}
export async function getTrending(
  locale: string,
  type: "all" | MediaType = "all",
): Promise<Title[]> {
  if (process.env.FILMGRAM_FIXTURES === "1") {
    if (type !== "all") return fixtures.filter((x) => x.media_type === type);
    const films = fixtures.filter((x) => x.media_type === "movie");
    const series = fixtures.filter((x) => x.media_type === "tv");
    return films.flatMap((film, i) =>
      series[i] ? [film, series[i]] : [film],
    ) as Title[];
  }
  const data = z
    .object({ results: z.array(z.unknown()) })
    .parse(await request(`/trending/${type}/day`, locale, 600));
  return data.results.flatMap((entry) => {
    const parsed = itemSchema.safeParse(entry);
    if (!parsed.success) return [];
    const x = parsed.data;
    const media = x.media_type || (type === "all" ? undefined : type);
    const name = media === "movie" ? x.title : x.name;
    return media && name?.trim() ? [{ ...x, media_type: media }] : [];
  });
}
export async function getDetail(
  locale: string,
  type: MediaType,
  id: number,
): Promise<Title | null> {
  if (process.env.FILMGRAM_FIXTURES === "1") {
    const fixture = fixtures.find((x) => x.media_type === type && x.id === id);
    if (!fixture || type !== "movie" || id !== 1726) return fixture || null;
    return {
      ...fixture,
      original_title: "Iron Man",
      original_language: "en",
      spoken_languages: [
        { iso_639_1: "en", name: "English", english_name: "English" },
      ],
      production_countries: [
        { iso_3166_1: "US", name: "United States of America" },
      ],
      production_companies: [
        { id: 420, name: "Marvel Studios", origin_country: "US" },
      ],
      budget: 140000000,
      revenue: 585174222,
      status: "Released",
      tagline: "Heroes aren't born. They're built.",
      credits: fixture.credits
        ? {
            ...fixture.credits,
            crew: [
              ...(fixture.credits.crew || []),
              {
                id: 10850,
                name: "Ramin Djawadi",
                job: "Original Music Composer",
                department: "Sound",
              },
            ],
          }
        : undefined,
    };
  }
  try {
    const data = detailSchema.parse(
      await request(`/${type}/${id}?append_to_response=credits`, locale),
    );
    return { ...data, media_type: type };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
}

const regionCode = /^[A-Z]{2}$/;
export function movieRegion(locale: string, region?: string): string {
  const normalized = region?.trim().toUpperCase();
  if (normalized && regionCode.test(normalized)) return normalized;
  return locale === "pt-BR" ? "BR" : locale === "es" ? "ES" : "US";
}
const releaseSchema = z.object({
  type: z.number().int().min(1).max(6),
  certification: z.string().trim().optional().catch(undefined),
  release_date: z.iso.datetime({ offset: true }).or(z.iso.date()),
});
const releaseResult = z.object({
  iso_3166_1: z.string(),
  release_dates: validItems(releaseSchema),
});
export type MovieRelease = {
  date: string;
  type: number;
  certification: string | null;
};
const getMovieReleaseResults = cache(async (locale: string, id: number) => {
  if (process.env.FILMGRAM_FIXTURES === "1") {
    return id === 1726
      ? [
          {
            iso_3166_1: "BR",
            release_dates: [
              { release_date: "2008-04-30", certification: "12", type: 3 },
            ],
          },
          {
            iso_3166_1: "US",
            release_dates: [
              { release_date: "2008-05-02", certification: "PG-13", type: 3 },
            ],
          },
          {
            iso_3166_1: "ES",
            release_dates: [
              { release_date: "2008-04-30", certification: "12", type: 3 },
            ],
          },
        ]
      : [];
  }
  return z
    .object({ results: validItems(releaseResult) })
    .parse(await request(`/movie/${id}/release_dates`, locale, 3600)).results;
});
export async function getMovieReleaseCountries(
  locale: string,
  id: number,
): Promise<string[]> {
  const releases = await getMovieReleaseResults(locale, id);
  return [
    ...new Set(
      releases
        .filter(
          (row) =>
            regionCode.test(row.iso_3166_1) && row.release_dates.length > 0,
        )
        .map((row) => row.iso_3166_1),
    ),
  ].sort();
}
export async function getMovieReleases(
  locale: string,
  id: number,
  region?: string,
): Promise<MovieRelease[]> {
  const country = movieRegion(locale, region);
  const releases = await getMovieReleaseResults(locale, id);
  const rows = releases
    .filter((entry) => entry.iso_3166_1 === country)
    .flatMap((entry) => entry.release_dates);
  const values = rows.map((row) => ({
    date: row.release_date.slice(0, 10),
    type: row.type,
    certification: row.certification || null,
  }));
  return [
    ...new Map(values.map((row) => [JSON.stringify(row), row])).values(),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.type - b.type);
}

const videoSchema = z.object({
  id: namedItem,
  key: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  name: namedItem,
  type: namedItem,
  site: z.literal("YouTube"),
  official: z
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  published_at: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value ?? null),
});
export type MovieVideo = Omit<z.infer<typeof videoSchema>, "site">;
export async function getMovieVideos(
  locale: string,
  id: number,
): Promise<MovieVideo[]> {
  if (process.env.FILMGRAM_FIXTURES === "1")
    return id === 1726
      ? [
          {
            id: "iron-man-trailer",
            key: "8ugaeA-nMTc",
            name: "Official Trailer",
            type: "Trailer",
            official: true,
            published_at: null,
          },
        ]
      : [];
  const data = z
    .object({ results: validItems(videoSchema) })
    .parse(await request(`/movie/${id}/videos`, locale, 3600));
  const ranked = data.results.sort(
    (a, b) =>
      Number(b.official) - Number(a.official) ||
      Number(b.type === "Trailer") - Number(a.type === "Trailer") ||
      (b.published_at ?? "").localeCompare(a.published_at ?? ""),
  );
  const seen = new Set<string>();
  return ranked.filter(({ key }) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const providerSchema = z.object({
  provider_id: positiveId,
  provider_name: namedItem,
  logo_path: z.string().nullable().optional().catch(undefined),
  display_priority: z.number().optional().catch(undefined),
});
export type WatchProvider = z.infer<typeof providerSchema>;
const providerModes = ["flatrate", "rent", "buy", "ads", "free"] as const;
const providerRegion = z.object({
  link: z.string().optional().catch(undefined),
  flatrate: validItems(providerSchema).optional().catch(undefined),
  rent: validItems(providerSchema).optional().catch(undefined),
  buy: validItems(providerSchema).optional().catch(undefined),
  ads: validItems(providerSchema).optional().catch(undefined),
  free: validItems(providerSchema).optional().catch(undefined),
});
export type MovieWatchProviders = Record<
  (typeof providerModes)[number],
  WatchProvider[]
> & {
  region: string;
  link: string | null;
};
function tmdbProviderLink(value?: string) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      ["www.themoviedb.org", "themoviedb.org"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
const getMovieProviderResults = cache(
  async (locale: string, id: number): Promise<Record<string, unknown>> => {
    const data =
      process.env.FILMGRAM_FIXTURES === "1"
        ? {
            results:
              id === 1726
                ? {
                    BR: {
                      link: "https://www.themoviedb.org/movie/1726/watch?locale=BR",
                      flatrate: [
                        {
                          provider_id: 337,
                          provider_name: "Disney Plus",
                          display_priority: 1,
                        },
                      ],
                    },
                    US: {
                      link: "https://www.themoviedb.org/movie/1726/watch?locale=US",
                      rent: [
                        {
                          provider_id: 2,
                          provider_name: "Apple TV",
                          display_priority: 1,
                        },
                      ],
                    },
                  }
                : {},
          }
        : z
            .object({ results: z.record(z.string(), z.unknown()) })
            .parse(await request(`/movie/${id}/watch/providers`, locale, 3600));
    return data.results;
  },
);

export async function getMovieProviderCountries(
  locale: string,
  id: number,
): Promise<string[]> {
  const results = await getMovieProviderResults(locale, id);
  return Object.keys(results)
    .filter((country) => {
      if (!regionCode.test(country)) return false;
      const result = providerRegion.safeParse(results[country]);
      return (
        result.success &&
        providerModes.some((mode) => (result.data[mode]?.length ?? 0) > 0)
      );
    })
    .sort();
}

export async function getMovieWatchProviders(
  locale: string,
  id: number,
  region?: string,
): Promise<MovieWatchProviders | null> {
  const country = movieRegion(locale, region);
  const results = await getMovieProviderResults(locale, id);
  const result = providerRegion.safeParse(results[country]);
  if (!result.success) return null;
  const sort = (mode: (typeof providerModes)[number]) =>
    [
      ...new Map(
        (result.data[mode] || []).map((item) => [item.provider_id, item]),
      ).values(),
    ].sort(
      (a, b) =>
        (a.display_priority ?? Infinity) - (b.display_priority ?? Infinity) ||
        a.provider_id - b.provider_id,
    );
  const options: MovieWatchProviders = {
    region: country,
    link: tmdbProviderLink(result.data.link),
    flatrate: sort("flatrate"),
    rent: sort("rent"),
    buy: sort("buy"),
    ads: sort("ads"),
    free: sort("free"),
  };
  return providerModes.some((mode) => options[mode].length > 0)
    ? options
    : null;
}

/** Small, public catalog metadata for social cards; never includes credits. */
export async function getFeedTitle(
  locale: string,
  type: MediaType,
  id: number,
): Promise<Title | null> {
  if (process.env.FILMGRAM_FIXTURES === "1")
    return fixtures.find((x) => x.media_type === type && x.id === id) || null;
  const data = itemSchema.parse(await request(`/${type}/${id}`, locale, 3600));
  return { ...data, media_type: type };
}

export async function getTopRated(
  locale: string,
  type: "all" | MediaType = "all",
): Promise<Title[]> {
  if (process.env.FILMGRAM_FIXTURES === "1")
    return [...fixtures]
      .filter((x) => type === "all" || x.media_type === type)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  const types: MediaType[] = type === "all" ? ["movie", "tv"] : [type];
  const lists = await Promise.all(
    types.map(async (media) => {
      const data = z
        .object({ results: z.array(z.unknown()) })
        .parse(await request(`/${media}/top_rated`, locale));
      return data.results.flatMap((entry) => {
        const parsed = itemSchema.safeParse(entry);
        if (
          !parsed.success ||
          !(media === "movie" ? parsed.data.title : parsed.data.name)?.trim()
        )
          return [];
        return [{ ...parsed.data, media_type: media }];
      });
    }),
  );
  return lists
    .flat()
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
}

export async function getPopular(
  locale: string,
  type: "all" | MediaType = "all",
): Promise<Title[]> {
  if (process.env.FILMGRAM_FIXTURES === "1") {
    if (type !== "all")
      return fixtures.filter((x) => x.media_type === type).slice(0, 12);
    const films = fixtures.filter((x) => x.media_type === "movie");
    const series = fixtures.filter((x) => x.media_type === "tv");
    return films
      .flatMap((film, i) => (series[i] ? [film, series[i]] : [film]))
      .slice(0, 12) as Title[];
  }
  const types: MediaType[] = type === "all" ? ["movie", "tv"] : [type];
  const lists = await Promise.all(
    types.map(async (media) => {
      const data = z
        .object({ results: z.array(z.unknown()) })
        .parse(await request(`/${media}/popular`, locale, 600));
      return data.results.flatMap((entry) => {
        const parsed = itemSchema.safeParse(entry);
        if (
          !parsed.success ||
          !(media === "movie" ? parsed.data.title : parsed.data.name)?.trim()
        )
          return [];
        return [{ ...parsed.data, media_type: media }];
      });
    }),
  );
  return (lists[0] || [])
    .flatMap((item, i) => {
      const other = lists[1]?.[i];
      return other ? [item, other] : [item];
    })
    .slice(0, 12);
}

const personSchema = z.object({
  id: z.number().int().positive().safe(),
  name: z.string().trim().min(1),
  biography: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  deathday: z.string().nullable().optional(),
  place_of_birth: z.string().nullable().optional(),
  also_known_as: z.array(z.string()).nullable().optional(),
  known_for_department: z.string().nullable().optional(),
  profile_path: z.string().nullable().optional(),
  combined_credits: z.object({
    cast: z.array(z.unknown()).nullable().optional(),
    crew: z.array(z.unknown()).nullable().optional(),
  }),
});
export type Person = Omit<z.infer<typeof personSchema>, "combined_credits"> & {
  works: PersonWork[];
};
export type { PersonWork } from "@/features/people/filmography";

export async function getPersonDetails(
  locale: string,
  id: number,
): Promise<Person | null> {
  let raw: unknown;
  if (process.env.FILMGRAM_FIXTURES === "1") {
    const fixture =
      id === 90000001
        ? {
            id,
            name: "Filmgram pagination fixture",
            biography: null,
            birthday: null,
            deathday: null,
            place_of_birth: null,
            also_known_as: [],
            known_for_department: null,
            profile_path: null,
            combined_credits: {
              cast: Array.from({ length: 25 }, (_, index) => ({
                id: 900001 + index,
                media_type: "movie",
                title: "Fixture movie " + String(index + 1).padStart(2, "0"),
                character: "Fixture role",
              })),
              crew: [],
            },
          }
        : peopleFixtureData.find((person) => person.id === id);
    if (!fixture) return null;
    const cast = fixtures.flatMap((item) =>
      (item.credits?.cast || [])
        .filter((member) => member.id === id)
        .map((member) => ({ ...item, character: member.character })),
    );
    const crew = fixtures.flatMap((item) =>
      (item.credits?.crew || [])
        .filter((member) => member.id === id)
        .map((member) => ({ ...item, job: member.job })),
    );
    raw = {
      ...fixture,
      combined_credits: fixture.combined_credits ?? { cast, crew },
    };
  } else {
    try {
      raw = await request(
        "/person/" + id + "?append_to_response=combined_credits",
        locale,
        3600,
      );
    } catch (error) {
      if (error instanceof TmdbError && error.status === 404) return null;
      throw error;
    }
  }
  const { combined_credits, ...person } = personSchema.parse(raw);
  return {
    ...person,
    works: normalizePersonWorks(
      combined_credits.cast || [],
      combined_credits.crew || [],
    ),
  };
}
