"use server";
import {
  getReviewComment,
  getReviewLikeSummaries,
} from "./review-discussion-queries";
import { supabase } from "@/integrations/supabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== "string" || !uuid.test(value))
    throw new Error("Invalid identifier");
  return value;
}
async function client() {
  const db = await supabase();
  if (!db) throw new Error("Service unavailable");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("Please sign in");
  return db;
}
function body(form: FormData): string {
  const value = form.get("body");
  if (
    typeof value !== "string" ||
    !value.trim() ||
    Array.from(value.trim()).length > 2000
  )
    throw new Error("Invalid comment");
  return value.trim();
}
export async function setReviewLike(form: FormData) {
  const reviewId = id(form, "review_id");
  const liked = form.get("liked");
  if (liked !== "true" && liked !== "false") throw new Error("Invalid like");
  const db = await client();
  const { error } = await db.rpc("set_review_like", {
    p_review_id: reviewId,
    p_liked: liked === "true",
  });
  if (error) throw error;
  return (await getReviewLikeSummaries(db, [reviewId]))[reviewId];
}
export async function createReviewComment(form: FormData) {
  const reviewId = id(form, "review_id");
  const targetId = form.has("target_comment_id")
    ? id(form, "target_comment_id")
    : null;
  const text = body(form);
  const db = await client();
  const { data, error } = await db.rpc("create_review_comment_with_mention", {
    p_review_id: reviewId,
    p_target_comment_id: targetId,
    p_body: text,
  });
  if (error) throw error;
  return getReviewComment(db, data);
}
export async function updateReviewComment(form: FormData) {
  const commentId = id(form, "comment_id"),
    text = body(form);
  const db = await client();
  const { error } = await db.rpc("update_review_comment", {
    p_comment_id: commentId,
    p_body: text,
  });
  if (error) throw error;
  return getReviewComment(db, commentId);
}
export async function deleteReviewComment(form: FormData) {
  const commentId = id(form, "comment_id");
  const db = await client();
  const { error } = await db.rpc("delete_review_comment", {
    p_comment_id: commentId,
  });
  if (error) throw error;
  return getReviewComment(db, commentId);
}

export async function setReviewCommentLike(form: FormData) {
  const commentId = id(form, "comment_id");
  const liked = form.get("liked");
  if (liked !== "true" && liked !== "false") throw new Error("Invalid like");
  const db = await client();
  const { data, error } = await db
    .rpc("set_review_comment_like", {
      p_comment_id: commentId,
      p_liked: liked === "true",
    })
    .single();
  if (error) throw error;
  return { count: Number(data.like_count), liked: data.liked };
}
