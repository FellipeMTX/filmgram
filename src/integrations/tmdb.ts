import { z } from "zod";
import "server-only";
import fixtureData from "./fixtures.json";
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
    })
    .optional(),
});
export type Title = z.infer<typeof detailSchema> & { media_type: MediaType };
const fixtures: Title[] = fixtureData as Title[];
export { titleName, year, imageUrl } from "./tmdb-display";
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
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
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
    if (error instanceof Error && error.message.includes("404")) return null;
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
