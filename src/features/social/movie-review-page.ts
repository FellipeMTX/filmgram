"use server";
import { supabase } from "@/integrations/supabase";
import { getReviewLikeSummaries } from "./review-discussion-queries";
import { z } from "zod";

const uuid = z.guid();
const cursorSchema = z.object({
  followed: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  id: uuid,
});
export type MovieReviewCursor = z.infer<typeof cursorSchema>;
export async function loadMovieReviewPage(
  tmdbId: number,
  selectedId: string | null,
  cursor?: MovieReviewCursor,
) {
  if (!Number.isSafeInteger(tmdbId) || tmdbId < 1)
    throw new Error("Invalid title");
  if (cursor) cursorSchema.parse(cursor);
  const selected =
    selectedId && uuid.safeParse(selectedId).success ? selectedId : null;
  const db = await supabase();
  if (!db) throw new Error("Database unavailable");
  const [page, target] = await Promise.all([
    db.rpc("movie_review_page", {
      p_tmdb_id: tmdbId,
      p_after_followed: cursor?.followed ?? null,
      p_after_created_at: cursor?.createdAt ?? null,
      p_after_id: cursor?.id ?? null,
      p_limit: 21,
    }),
    selected && !cursor
      ? db
          .from("reviews")
          .select(
            "id,rating,body,body_document,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
          )
          .eq("media_type", "movie")
          .eq("tmdb_id", tmdbId)
          .eq("id", selected)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (page.error) throw page.error;
  if (target.error) throw target.error;
  const rows = page.data.slice(0, 20);
  let targetRow: (typeof rows)[number] | null = null;
  if (target.data) {
    const existing = rows.find((r) => r.id === target.data!.id);
    if (existing) targetRow = existing;
    else {
      const {
        data: { user },
      } = await db.auth.getUser();
      const follow = user
        ? await db
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .eq("following_id", target.data.user_id)
            .maybeSingle()
        : { data: null, error: null };
      if (follow.error) throw follow.error;
      targetRow = {
        ...target.data,
        display_name: target.data.profiles?.display_name ?? null,
        handle: target.data.profiles?.handle ?? null,
        avatar_url: target.data.profiles?.avatar_url ?? null,
        followed: !!follow.data,
      };
    }
  }
  const pageRows =
    targetRow && !rows.some((row) => row.id === targetRow.id)
      ? rows.slice(0, 19)
      : rows;
  const last = pageRows.at(-1);
  const reviews = targetRow
    ? [targetRow, ...pageRows.filter((row) => row.id !== targetRow.id)]
    : pageRows;
  const summaries = await getReviewLikeSummaries(
    db,
    reviews.map((r) => r.id),
  );
  return {
    reviews,
    summaries,
    next:
      page.data.length > pageRows.length && last
        ? { followed: last.followed, createdAt: last.created_at, id: last.id }
        : null,
  };
}
