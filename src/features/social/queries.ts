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
  const { data, error } = await db
    .from("playlists")
    .select(
      "id,user_id,name,description,is_public,playlist_items(id,media_type,tmdb_id,media_title,position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
