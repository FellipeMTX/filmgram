import { z } from "zod";
import "server-only";
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
const fixtures: Title[] = [
  {
    id: 101,
    media_type: "movie",
    title: "Glass Tide",
    overview:
      "A missing brother draws an engineer back to her hometown, where the local dam conceals dangerous secrets.",
    poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop_path: "/7h6TqPB3ESmjuVbxCxAeB1c9OB1.jpg",
    release_date: "2025-03-14",
    vote_average: 8.4,
    genre_ids: [53, 18],
    genres: [
      { id: 53, name: "Thriller" },
      { id: 18, name: "Drama" },
    ],
    runtime: 108,
    credits: {
      cast: [
        { id: 1, name: "Livia Torres", character: "Elena" },
        { id: 2, name: "Caio Diaz", character: "Rafael" },
      ],
    },
  },
  {
    id: 102,
    media_type: "movie",
    title: "The Last Ferry",
    overview: "A final crossing brings strangers together.",
    poster_path: "/kqjL17yufvn9OVLyXYpvtyrFfak.jpg",
    backdrop_path: "/nAxGnGHOsfzufThz20zgmRwKur3.jpg",
    release_date: "2024-06-01",
    vote_average: 8.2,
    genre_ids: [18],
  },
  {
    id: 103,
    media_type: "movie",
    title: "Crimson Valley",
    overview: "A journey into the unknown.",
    poster_path: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    backdrop_path: "/wW7Wt5bXzPy4VOEE4LTIUDyDgBo.jpg",
    release_date: "2024-01-01",
    vote_average: 7.9,
    genre_ids: [53],
  },
  {
    id: 201,
    media_type: "tv",
    name: "The Long Night",
    overview: "A town holds its breath through one long night.",
    poster_path: "/z2yahl2uefxDCl0nogcRBstwruJ.jpg",
    backdrop_path: "/9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg",
    first_air_date: "2025-01-01",
    vote_average: 8.6,
    genre_ids: [18],
    genres: [{ id: 18, name: "Drama" }],
    credits: { cast: [] },
  },
  {
    id: 202,
    media_type: "tv",
    name: "Beyond the Pines",
    overview: "Old secrets surface in a small town.",
    poster_path: "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
    backdrop_path: "/suopoADq0k8YZr4dQXcU6pToj6s.jpg",
    first_air_date: "2023-01-01",
    vote_average: 8.1,
    genre_ids: [18],
  },
  {
    id: 105,
    media_type: "movie",
    title: "The Unseen",
    overview: "A story waiting to be discovered.",
    poster_path: null,
    backdrop_path: null,
    release_date: "2024-01-01",
    vote_average: 7.5,
    genre_ids: [18],
  },
  {
    id: 104,
    media_type: "movie",
    title: "Open Water",
    overview: "A story of second chances.",
    poster_path: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    backdrop_path: "/iNh3BivHyg5sQRPP1KOkzguEX0H.jpg",
    release_date: "2022-01-01",
    vote_average: 8.3,
    genre_ids: [18],
  },
];
export const titleName = (item: Title) => item.title || item.name || "Untitled";
export const year = (item: Title) =>
  (item.release_date || item.first_air_date || "").slice(0, 4);
export const imageUrl = (path: string | null | undefined, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
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
  if (process.env.FILMGRAM_FIXTURES === "1")
    return fixtures.filter((x) => type === "all" || x.media_type === type);
  const data = z
    .object({ results: z.array(itemSchema) })
    .parse(await request(`/trending/${type}/day`, locale, 600));
  return data.results.flatMap((x) => {
    const media = x.media_type || (type === "all" ? undefined : type);
    return media ? [{ ...x, media_type: media }] : [];
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
        .object({ results: z.array(itemSchema) })
        .parse(await request(`/${media}/top_rated`, locale));
      return data.results.map((x) => ({ ...x, media_type: media }));
    }),
  );
  return lists
    .flat()
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
}
