"use server";
import { revalidatePath } from "next/cache";
import {
  parseReviewContent,
  reviewPlainText,
  reviewVideoId,
} from "./review-content";
import { supabase } from "@/integrations/supabase";
const text = (f: FormData, k: string) => String(f.get(k) || "").trim();
async function auth() {
  const db = await supabase();
  if (!db) throw new Error("Authentication is not configured");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Please sign in");
  return { db, user };
}
async function saveReview(form: FormData, revalidate: boolean) {
  const { db, user } = await auth();
  const ratingInput = form.get("rating");
  const rating = Number(ratingInput);
  const media_type = text(form, "media_type"),
    tmdb_id = Number(text(form, "tmdb_id"));
  if (
    typeof ratingInput !== "string" ||
    !/^(?:[0-9]|10)$/.test(ratingInput) ||
    !Number.isInteger(rating) ||
    !["movie", "tv"].includes(media_type) ||
    !Number.isInteger(tmdb_id) ||
    tmdb_id <= 0
  )
    throw new Error("Invalid review");
  const payload = text(form, "body_document");
  let document = null;
  if (payload) {
    if (payload.length > 90000) throw new Error("Invalid review content");
    try {
      document = parseReviewContent(JSON.parse(payload));
    } catch {
      throw new Error("Invalid review content");
    }
    if (!document) throw new Error("Invalid review content");
  }
  const url = text(form, "youtube");
  const videoBlock = document?.blocks.find((block) => block.type === "youtube");
  const video = reviewVideoId(videoBlock?.url ?? url);
  if (url && !video) throw new Error("Enter a valid YouTube video URL");
  const reviewId = text(form, "review_id");
  const values = {
    rating,
    body: (document ? reviewPlainText(document) : text(form, "body")) || null,
    body_document: document,
    youtube_video_id: video,
  };
  const result = reviewId
    ? await db
        .from("reviews")
        .update(values)
        .eq("id", reviewId)
        .eq("user_id", user.id)
        .eq("media_type", media_type)
        .eq("tmdb_id", tmdb_id)
        .select("id")
        .maybeSingle()
    : await db
        .from("reviews")
        .insert({ ...values, user_id: user.id, media_type, tmdb_id });
  const { error } = result;
  if (reviewId && !error && !result.data) throw new Error("Review not found");
  if (error) throw error;
  if (revalidate) revalidatePath("/", "layout");
}
export async function submitReviewFromModal(form: FormData) {
  await saveReview(form, false);
}
