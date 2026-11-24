"use server";

import { supabase, currentUser } from "@/integrations/supabase";
import { getDetail, type MediaType } from "@/integrations/tmdb";
import { getReviewLikeSummaries } from "./review-discussion-queries";
import { z } from "zod";

const cursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.guid(),
});
const reviewIdSchema = z.guid();
const PAGE_SIZE = 10;

export async function loadTitleReviewContext(
  locale: string,
  mediaType: MediaType,
  id: number,
  selectedId: string | null,
  cursor?: { createdAt: string; id: string },
) {
  if (
    !["movie", "tv"].includes(mediaType) ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !["en", "es", "pt-BR"].includes(locale)
  )
    throw new Error("Invalid title");
  if (selectedId) reviewIdSchema.parse(selectedId);
  if (cursor) cursorSchema.parse(cursor);
  const db = await supabase();
  if (!db) throw new Error("Database unavailable");
  const user = await currentUser();
  let query = db
    .from("reviews")
    .select(
      "id,rating,body,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
    )
    .eq("media_type", mediaType)
    .eq("tmdb_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (selectedId) query = query.neq("id", selectedId);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  const [result, item, stats, own, selected] = await Promise.all([
    query,
    getDetail(locale, mediaType, id),
    db
      .rpc("title_review_stats", { p_media_type: mediaType, p_tmdb_id: id })
      .single(),
    user
      ? db
          .from("reviews")
          .select("id,rating,body,youtube_video_id")
          .eq("media_type", mediaType)
          .eq("tmdb_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    selectedId
      ? db
          .from("reviews")
          .select("user_id")
          .eq("id", selectedId)
          .eq("media_type", mediaType)
          .eq("tmdb_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (result.error) throw result.error;
  if (stats.error) throw stats.error;
  if (own.error) throw own.error;
  if (selected.error) throw selected.error;
  const reviews = (result.data || []).slice(0, PAGE_SIZE);
  const authorIds = [
    ...new Set([
      ...reviews.map((r) => r.user_id),
      ...(selected.data ? [selected.data.user_id] : []),
    ]),
  ];
  const follows =
    user && authorIds.length
      ? await db
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .in("following_id", authorIds)
      : { data: [], error: null };
  if (follows.error) throw follows.error;
  const last = reviews.at(-1);
  const summaries = await getReviewLikeSummaries(
    db,
    reviews.map((r) => r.id),
  );
  return {
    reviews,
    own: own.data,
    selectedAuthorId: selected.data?.user_id || null,
    followed: follows.data.map((f) => f.following_id),
    count: Number(stats.data?.review_count || 0),
    average: Number(stats.data?.average_rating || 0),
    next:
      result.data.length > PAGE_SIZE && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
    summaries,
    userId: user?.id || null,
    overview: item?.overview || "",
  };
}
