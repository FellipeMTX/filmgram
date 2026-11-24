import { z } from "zod";
import "server-only";
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
const detailSchema = itemSchema.extend({
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
  if (process.env.FILMGRAM_FIXTURES === "1")
    return fixtures.find((x) => x.media_type === type && x.id === id) || null;
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
