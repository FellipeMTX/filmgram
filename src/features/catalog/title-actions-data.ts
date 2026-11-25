import { supabase } from "@/integrations/supabase";
import type { MediaType } from "@/integrations/tmdb";

export async function getTitleActionsData(
  db: Awaited<ReturnType<typeof supabase>>,
  mediaType: MediaType,
  tmdbId: number,
  userId: string | undefined,
) {
  if (!db || !userId)
    return { states: {} as Record<string, boolean>, playlists: [] };

  const [favorite, watched, liked, playlists] = await Promise.all([
    db
      .from("favorites")
      .select("user_id")
      .eq("user_id", userId)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId)
      .maybeSingle(),
    db
      .from("watched")
      .select("user_id")
      .eq("user_id", userId)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId)
      .maybeSingle(),
    db
      .from("title_likes")
      .select("user_id")
      .eq("user_id", userId)
      .eq("media_type", mediaType)
      .eq("tmdb_id", tmdbId)
      .maybeSingle(),
    db
      .from("playlists")
      .select("id,name,playlist_items(id)")
      .eq("user_id", userId)
      .eq("playlist_items.media_type", mediaType)
      .eq("playlist_items.tmdb_id", tmdbId)
      .order("name")
      .order("id"),
  ]);

  if (favorite.error) throw favorite.error;
  if (playlists.error) throw playlists.error;

  return {
    states: {
      favorites: !!favorite.data,
      watched: !!watched.data,
      title_likes: !!liked.data,
    },
    playlists: playlists.data.map((row) => ({
      id: row.id,
      name: row.name,
      contains: row.playlist_items.length > 0,
    })),
  };
}
