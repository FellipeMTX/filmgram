import "server-only";
import type { supabase } from "@/integrations/supabase";

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;

export async function getFavorites(db: Client, userId: string) {
  const { data, error } = await db
    .from("favorites")
    .select("media_type,tmdb_id,media_title,poster_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPlaylist(db: Client, id: string) {
  const { data: list, error } = await db
    .from("playlists")
    .select(
      "id,user_id,name,description,is_public,profiles(display_name,handle)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!list) return null;
  // Fetch in bounded pages instead of relying on PostgREST's default row cap.
  const items: Pick<
    import("@/types/database.generated").Database["public"]["Tables"]["playlist_items"]["Row"],
    "id" | "media_type" | "tmdb_id" | "media_title" | "poster_path" | "position"
  >[] = [];
  const pageSize = 500;
  let count = 0;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db
      .from("playlist_items")
      .select("id,media_type,tmdb_id,media_title,poster_path,position", {
        count: "exact",
      })
      .eq("playlist_id", id)
      .order("position")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    if (result.count === null)
      throw new Error("Could not verify playlist length");
    if (offset && result.count !== count)
      throw new Error("Playlist changed while loading; please refresh");
    count = result.count;
    items.push(...result.data);
    if (items.length >= count) break;
    if (!result.data.length)
      throw new Error("Could not load complete playlist");
  }
  if (
    items.length !== count ||
    new Set(items.map((item) => item.id)).size !== count
  )
    throw new Error("Playlist changed while loading; please refresh");
  return { ...list, playlist_items: items };
}
