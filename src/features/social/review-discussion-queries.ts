import "server-only";
import type { supabase } from "@/integrations/supabase";

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;
export type CommentCursor = { createdAt: string; id: string };
export type ReviewComment = {
  id: string;
  reviewId: string;
  parentId: string | null;
  userId: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  profile: {
    displayName: string;
    handle: string;
    avatarUrl: string | null;
  } | null;
};
export async function getReviewLikeSummaries(
  db: Client,
  reviewIds: string[],
): Promise<
  Record<string, { count: number; liked: boolean; commentCount: number }>
> {
  if (!reviewIds.length) return {};
  const { data, error } = await db.rpc("review_like_summaries", {
    p_review_ids: reviewIds,
  });
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [
      row.review_id,
      {
        count: Number(row.like_count),
        liked: row.liked,
        commentCount: Number(row.comment_count),
      },
    ]),
  );
}
export async function getReviewComments(
  db: Client,
  reviewId: string,
  parentId: string | null,
  cursor?: CommentCursor,
  limit = 20,
): Promise<{ comments: ReviewComment[]; nextCursor: CommentCursor | null }> {
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isSafeInteger(limit) ? limit : 20),
  );
  const { data, error } = await db.rpc("review_comments_page", {
    p_review_id: reviewId,
    p_parent_id: parentId,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: pageSize + 1,
  });
  if (error) throw error;
  const rows = data.slice(0, pageSize);
  const comments = rows.map((row) => ({
    id: row.id,
    reviewId: row.review_id,
    parentId: row.parent_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    profile:
      row.handle && row.display_name
        ? {
            handle: row.handle,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
          }
        : null,
  }));
  const last = comments.at(-1);
  return {
    comments,
    nextCursor:
      data.length > pageSize && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}
