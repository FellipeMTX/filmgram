import "server-only";
import type { supabase } from "@/integrations/supabase";

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;
export type PersonReview = {
  id: string;
  userId: string;
  rating: number;
  body: string | null;
  updatedAt: string;
  profile: { displayName: string; handle: string } | null;
  works: { mediaType: "movie" | "tv"; tmdbId: number }[];
};
type RawReview = {
  id: string;
  user_id: string;
  rating: number;
  body: string | null;
  updated_at: string;
  profiles: { display_name: string; handle: string } | null;
  person_review_works: {
    media_type: string;
    tmdb_id: number;
    position: number;
  }[];
};
function convert(row: RawReview): PersonReview {
  return {
    id: row.id,
    userId: row.user_id,
    rating: row.rating,
    body: row.body,
    updatedAt: row.updated_at,
    profile: row.profiles
      ? { displayName: row.profiles.display_name, handle: row.profiles.handle }
      : null,
    works: [...row.person_review_works]
      .sort((a, b) => a.position - b.position)
      .flatMap((work) =>
        work.media_type === "movie" || work.media_type === "tv"
          ? [{ mediaType: work.media_type, tmdbId: work.tmdb_id }]
          : [],
      ),
  };
}
const selection =
  "id,user_id,rating,body,updated_at,profiles(display_name,handle),person_review_works(media_type,tmdb_id,position)";
function unavailableReviews() {
  return {
    available: false as const,
    stats: null,
    myReview: null,
    reviews: [] as PersonReview[],
    page: 1,
    totalPages: 1,
  };
}
export async function getPersonReviewData(
  db: Client | null,
  personId: number,
  userId: string | null | undefined,
  requestedPage: number,
) {
  if (!db) return unavailableReviews();
  try {
    const { data: statData, error: statError } = await db.rpc(
      "person_rating_stats",
      { p_person_id: personId },
    );
    if (statError) throw statError;
    const stat = statData?.[0];
    if (!stat) throw new Error("Person review statistics unavailable");
    const count = Number(stat.review_count);
    const totalPages = Math.max(1, Math.ceil(count / 10));
    const page = Math.min(
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
      totalPages,
    );
    const [community, own] = await Promise.all([
      db
        .from("person_reviews")
        .select(selection)
        .eq("person_tmdb_id", personId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range((page - 1) * 10, page * 10 - 1),
      userId
        ? db
            .from("person_reviews")
            .select(selection)
            .eq("person_tmdb_id", personId)
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (community.error) throw community.error;
    if (own.error) throw own.error;
    return {
      available: true as const,
      stats: {
        averageRating:
          stat.average_rating === null ? null : Number(stat.average_rating),
        count,
      },
      myReview: own.data ? convert(own.data as unknown as RawReview) : null,
      reviews: (community.data as unknown as RawReview[]).map(convert),
      page,
      totalPages,
    };
  } catch {
    console.error("Failed to load Filmgram person reviews");
    return unavailableReviews();
  }
}
