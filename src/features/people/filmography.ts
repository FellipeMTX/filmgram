import { z } from "zod";
import type { MediaType, Title } from "@/integrations/tmdb";

export type PersonWork = Title & {
  characters: string[];
  jobs: string[];
  acting: boolean;
  directing: boolean;
};
export type WorkType = "all" | MediaType;
export type WorkActivity = "all" | "acting" | "directing";
type QueryValue = string | string[] | undefined;

const creditSchema = z.object({
  id: z.number().int().positive().safe(),
  media_type: z.enum(["movie", "tv"]),
  title: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  first_air_date: z.string().nullable().optional(),
  vote_average: z.number().finite().nullable().optional(),
  genre_ids: z.array(z.number()).nullable().optional(),
  character: z.string().nullable().optional(),
  job: z.string().nullable().optional(),
});

export function validCreditDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : "";
}

export function normalizePersonWorks(
  cast: unknown[],
  crew: unknown[],
): PersonWork[] {
  const works = new Map<string, PersonWork>();
  function add(entry: unknown, isCast: boolean) {
    const parsed = creditSchema.safeParse(entry);
    if (!parsed.success) return;
    const item = parsed.data;
    const job = item.job?.trim();
    if (!isCast && !job) return;
    const key = item.media_type + ":" + item.id;
    let work = works.get(key);
    if (!work) {
      work = {
        id: item.id,
        media_type: item.media_type,
        characters: [],
        jobs: [],
        acting: false,
        directing: false,
      };
      works.set(key, work);
    }
    // Individual credits may each carry different optional metadata.
    if (!work.title && item.title?.trim()) work.title = item.title;
    if (!work.name && item.name?.trim()) work.name = item.name;
    if (!work.overview && item.overview?.trim()) work.overview = item.overview;
    if (!work.poster_path && item.poster_path)
      work.poster_path = item.poster_path;
    if (!work.backdrop_path && item.backdrop_path)
      work.backdrop_path = item.backdrop_path;
    if (
      !validCreditDate(work.release_date) &&
      validCreditDate(item.release_date)
    )
      work.release_date = item.release_date!;
    if (
      !validCreditDate(work.first_air_date) &&
      validCreditDate(item.first_air_date)
    )
      work.first_air_date = item.first_air_date!;
    if (work.vote_average == null && item.vote_average != null)
      work.vote_average = item.vote_average;
    if ((!work.genre_ids || !work.genre_ids.length) && item.genre_ids?.length)
      work.genre_ids = item.genre_ids;
    if (isCast) {
      work.acting = true;
      const character = item.character?.trim();
      if (character && !work.characters.includes(character))
        work.characters.push(character);
    } else {
      if (job && !work.jobs.includes(job)) work.jobs.push(job);
      if (job === "Director") work.directing = true;
    }
  }
  cast.forEach((item) => add(item, true));
  crew.forEach((item) => add(item, false));
  function date(work: PersonWork) {
    return validCreditDate(
      work.media_type === "movie" ? work.release_date : work.first_air_date,
    );
  }
  return [...works.values()]
    .filter((work) =>
      (work.media_type === "movie" ? work.title : work.name)?.trim(),
    )
    .sort(
      (a, b) =>
        date(b).localeCompare(date(a)) ||
        a.media_type.localeCompare(b.media_type) ||
        a.id - b.id,
    );
}

export function filterAndPaginateWorks(
  works: PersonWork[],
  query: { type?: QueryValue; activity?: QueryValue; page?: QueryValue },
) {
  const type: WorkType =
    query.type === "movie" || query.type === "tv" ? query.type : "all";
  const activity: WorkActivity =
    query.activity === "acting" || query.activity === "directing"
      ? query.activity
      : "all";
  const filtered = works.filter(
    (work) =>
      (type === "all" || work.media_type === type) &&
      (activity === "all" || work[activity]),
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / 24));
  const number =
    typeof query.page === "string" && /^[1-9]\d*$/.test(query.page)
      ? Number(query.page)
      : 1;
  const page = Math.min(Number.isSafeInteger(number) ? number : 1, totalPages);
  return {
    works: filtered.slice((page - 1) * 24, page * 24),
    page,
    totalPages,
    total,
    type,
    activity,
  };
}
