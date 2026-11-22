"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/integrations/supabase";
const internal = (s: string) =>
  s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")
    ? s
    : "/en/discover";
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
export async function signIn(form: FormData) {
  const db = await supabase();
  if (!db) throw new Error("Authentication is not configured");
  const h = await headers();
  const origin =
    h.get("origin") ||
    `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  const next = internal(text(form, "next"));
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) throw error || new Error("Unable to sign in");
  redirect(data.url);
}
export async function signOut() {
  const db = await supabase();
  await db?.auth.signOut();
  redirect("/en/discover");
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
export async function submitReview(form: FormData) {
  const { db, user } = await auth();
  const rating = Number(text(form, "rating"));
  const media_type = text(form, "media_type"),
    tmdb_id = Number(text(form, "tmdb_id"));
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    !["movie", "tv"].includes(media_type) ||
    !Number.isInteger(tmdb_id) ||
    tmdb_id <= 0
  )
    throw new Error("Invalid review");
  const url = text(form, "youtube");
  let video: string | null = null;
  if (url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") video = u.pathname.slice(1);
      else if (
        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
      )
        video = u.searchParams.get("v");
      if (!video || !/^[\w-]{11}$/.test(video)) throw new Error();
    } catch {
      throw new Error("Enter a valid YouTube video URL");
    }
  }
  const { error } = await db.from("reviews").upsert(
    {
      user_id: user.id,
      media_type,
      tmdb_id,
      rating,
      body: text(form, "body") || null,
      youtube_video_id: video,
    },
    { onConflict: "user_id,media_type,tmdb_id" },
  );
  if (error) throw error;
  revalidatePath("/", "layout");
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
  const { db, user } = await auth();
  const playlist_id = text(form, "playlist_id");
  const { data: playlist } = await db
    .from("playlists")
    .select("id")
    .eq("id", playlist_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!playlist) throw new Error("Playlist not found");
  const { data: items } = await db
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlist_id)
    .order("position", { ascending: false })
    .limit(1);
  const { error } = await db.from("playlist_items").insert({
    playlist_id,
    media_type: text(form, "media_type"),
    tmdb_id: Number(text(form, "tmdb_id")),
    media_title: text(form, "media_title"),
    poster_path: text(form, "poster_path") || null,
    position: (items?.[0]?.position ?? -1) + 1,
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function removePlaylistItem(form: FormData) {
  const { db } = await auth();
  const { error } = await db
    .from("playlist_items")
    .delete()
    .eq("id", text(form, "id"));
  if (error) throw error;
  revalidatePath("/", "layout");
}
export async function reorderPlaylist(form: FormData) {
  const { db } = await auth();
  const { error } = await db.rpc("reorder_playlist_items", {
    p_playlist_id: text(form, "playlist_id"),
    p_item_ids: text(form, "ids").split(",").filter(Boolean),
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
