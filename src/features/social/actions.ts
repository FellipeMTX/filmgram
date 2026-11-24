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
export async function toggleTitle(form: FormData) {
  const { db, user } = await auth();
  const table = text(form, "table");
  if (table !== "favorites" && table !== "watched" && table !== "title_likes")
    throw new Error("Invalid action");
  const media_type = text(form, "media_type"),
    tmdb_id = Number(text(form, "tmdb_id"));
  if (
    !["movie", "tv"].includes(media_type) ||
    !Number.isInteger(tmdb_id) ||
    tmdb_id <= 0
  )
    throw new Error("Invalid title");
  const key = { user_id: user.id, media_type, tmdb_id };
  const { data: existing, error: readError } = await db
    .from(table)
    .select("user_id")
    .match(key)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { error } = await db.from(table).delete().match(key);
    if (error) throw error;
  } else if (table === "title_likes") {
    const { error } = await db.from("title_likes").insert(key);
    if (error) throw error;
  } else {
    const row = {
      ...key,
      media_title: text(form, "media_title"),
      poster_path: text(form, "poster_path") || null,
      genre_ids: text(form, "genre_ids").split(",").filter(Boolean).map(Number),
    };
    const { error } = await db.from(table).insert(row);
    if (error) throw error;
  }
  revalidatePath("/", "layout");
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
  const { error } = await db.from("reviews").upsert(
    {
      user_id: user.id,
      media_type,
      tmdb_id,
      rating,
      body: (document ? reviewPlainText(document) : text(form, "body")) || null,
      body_document: document,
      youtube_video_id: video,
    },
    { onConflict: "user_id,media_type,tmdb_id" },
  );
  if (error) throw error;
  if (revalidate) revalidatePath("/", "layout");
}
export async function submitReview(form: FormData) {
  await saveReview(form, true);
}
export async function submitReviewFromModal(form: FormData) {
  await saveReview(form, false);
}
export async function createPlaylist(form: FormData) {
  const { db, user } = await auth();
  const name = text(form, "name");
  if (!name || name.length > 100) throw new Error("Invalid name");
  const { error } = await db.from("playlists").insert({
    user_id: user.id,
    name,
    description: text(form, "description") || null,
    is_public: form.has("is_public"),
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function addToPlaylist(form: FormData) {
  const { db } = await auth();
  const { error } = await db.rpc("append_playlist_item", {
    p_playlist_id: text(form, "playlist_id"),
    p_media_type: text(form, "media_type"),
    p_tmdb_id: Number(text(form, "tmdb_id")),
    p_media_title: text(form, "media_title"),
    p_poster_path: text(form, "poster_path") || undefined,
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function setTitleCollection(form: FormData) {
  const { db, user } = await auth();
  const media_type = text(form, "media_type");
  const tmdb_id = Number(text(form, "tmdb_id"));
  const destination = text(form, "destination");
  const desired = text(form, "desired");
  if (
    !["movie", "tv"].includes(media_type) ||
    !Number.isSafeInteger(tmdb_id) ||
    tmdb_id <= 0 ||
    !["true", "false"].includes(desired)
  )
    throw new Error("Invalid collection request");
  const saved = desired === "true";
  if (destination === "saved") {
    const key = { user_id: user.id, media_type, tmdb_id };
    const result = saved
      ? await db.from("favorites").upsert(
          {
            ...key,
            media_title: text(form, "media_title"),
            poster_path: text(form, "poster_path") || null,
            genre_ids: text(form, "genre_ids")
              .split(",")
              .filter(Boolean)
              .map(Number),
          },
          { onConflict: "user_id,media_type,tmdb_id", ignoreDuplicates: true },
        )
      : await db.from("favorites").delete().match(key);
    if (result.error) throw result.error;
  } else {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(destination))
      throw new Error("Invalid playlist");
    const owner = await db
      .from("playlists")
      .select("id")
      .eq("id", destination)
      .eq("user_id", user.id)
      .maybeSingle();
    if (owner.error) throw owner.error;
    if (!owner.data) throw new Error("Playlist not accessible");
    if (saved) {
      const result = await db.rpc("append_playlist_item", {
        p_playlist_id: destination,
        p_media_type: media_type,
        p_tmdb_id: tmdb_id,
        p_media_title: text(form, "media_title"),
        p_poster_path: text(form, "poster_path") || undefined,
      });
      if (result.error) throw result.error;
    } else {
      const item = await db
        .from("playlist_items")
        .select("id")
        .eq("playlist_id", destination)
        .eq("media_type", media_type)
        .eq("tmdb_id", tmdb_id)
        .maybeSingle();
      if (item.error) throw item.error;
      if (item.data) {
        const result = await db.rpc("remove_playlist_item", {
          p_playlist_id: destination,
          p_item_id: item.data.id,
        });
        if (result.error) throw result.error;
      }
    }
  }
  revalidatePath("/", "layout");
  return saved;
}
export async function removePlaylistItem(form: FormData) {
  const { db } = await auth();
  const { error } = await db.rpc("remove_playlist_item", {
    p_playlist_id: text(form, "playlist_id"),
    p_item_id: text(form, "id"),
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function reorderPlaylist(form: FormData) {
  const { db } = await auth();
  const { error } = await db.rpc("reorder_playlist_items", {
    p_playlist_id: text(form, "playlist_id"),
    p_item_ids: text(form, "ids").split(",").filter(Boolean),
    p_expected_ids: text(form, "expected_ids").split(",").filter(Boolean),
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function toggleFollow(form: FormData) {
  const { db, user } = await auth();
  const following_id = text(form, "following_id");
  if (following_id === user.id) throw new Error("Cannot follow yourself");
  const key = { follower_id: user.id, following_id };
  const { data } = await db
    .from("follows")
    .select("follower_id")
    .match(key)
    .maybeSingle();
  const { error } = data
    ? await db.from("follows").delete().match(key)
    : await db.from("follows").insert(key);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deleteReview(form: FormData) {
  const { db, user } = await auth();
  const { error } = await db
    .from("reviews")
    .delete()
    .eq("id", text(form, "id"))
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/", "layout");
}
