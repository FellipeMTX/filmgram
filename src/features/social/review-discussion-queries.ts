import "server-only";
import type { Database } from "@/types/database.generated";
import type { supabase } from "@/integrations/supabase";

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;
export type CommentCursor = { createdAt: string; id: string };
export type ReviewComment = {
  id: string;
  reviewId: string;
  parentId: string | null;
  replyToHandle: string | null;
  userId: string | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  likeCount: number;
  liked: boolean;
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
async function getReviewCommentLikes(db: Client, ids: string[]) {
  if (!ids.length)
    return new Map<string, { likeCount: number; liked: boolean }>();
  const { data, error } = await db.rpc("review_comment_like_summaries", {
    p_comment_ids: ids,
  });
  if (error) throw error;
  return new Map(
    data.map((row) => [
      row.comment_id,
      { likeCount: Number(row.like_count), liked: row.liked },
    ]),
  );
}

export async function getReviewComments(
  db: Client,
  reviewId: string,
  cursor?: CommentCursor,
  limit = 20,
): Promise<{ comments: ReviewComment[]; nextCursor: CommentCursor | null }> {
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isSafeInteger(limit) ? limit : 20),
  );
  const { data, error } = await db.rpc("flat_review_comments_page", {
    p_review_id: reviewId,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: pageSize + 1,
  });
  if (error) throw error;
  const rows = data.slice(0, pageSize);
  const likes = await getReviewCommentLikes(
    db,
    rows.map((row) => row.id),
  );
  const comments = rows.map((row) => toComment(row, likes.get(row.id)));
  const last = comments.at(-1);
  return {
    comments,
    nextCursor:
      data.length > pageSize && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}

export async function getReviewComment(
  db: Client,
  id: string,
): Promise<ReviewComment> {
  const { data, error } = await db
    .from("flat_review_comments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const likes = await getReviewCommentLikes(db, [id]);
  return toComment(data, likes.get(id));
}

function toComment(
  row: Database["public"]["Views"]["flat_review_comments"]["Row"],
  likes?: { likeCount: number; liked: boolean },
): ReviewComment {
  return {
    id: row.id,
    reviewId: row.review_id,
    parentId: row.parent_id,
    replyToHandle: row.reply_to_handle,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    likeCount: likes?.likeCount ?? 0,
    liked: likes?.liked ?? false,
    profile:
      row.handle && row.display_name
        ? {
            handle: row.handle,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
          }
        : null,
  };
}
