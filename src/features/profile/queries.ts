import "server-only";
import { cache } from "react";
import { supabase } from "@/integrations/supabase";
import { getFeedTitle } from "@/integrations/tmdb";
import type {
  ProfileHistoryItem,
  ProfilePage,
  ProfilePeriod,
  ProfileTitle,
} from "./types";

const PAGE_SIZE = 12;
const offset = (page: number) =>
  (Math.max(1, Math.min(834, Math.floor(page) || 1)) - 1) * PAGE_SIZE;
const cachedTitle = cache(getFeedTitle);

const database = cache(async () => {
  const db = await supabase();
  if (!db) throw new Error("Database is not configured");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Please sign in");
  return { db, user };
});

async function viewingPage(
  kind: "history" | "ranking",
  period: ProfilePeriod,
  page = 1,
  type: "all" | "movie" | "tv" = "all",
  limit = PAGE_SIZE,
): Promise<ProfilePage<ProfileHistoryItem>> {
  const { db } = await database();
  const { data, error } = await db.rpc("profile_viewing_titles", {
    p_period: period,
    p_ranking: kind === "ranking",
    p_limit: limit,
    p_offset: offset(page),
    p_type: type,
  });
  if (error) throw error;
  return {
    items: (data || []).map((row) => ({
      mediaType: row.media_type as "movie" | "tv",
      tmdbId: row.tmdb_id,
      title: row.media_title || `#${row.tmdb_id}`,
      posterPath: row.poster_path,
      lastWatchedAt: row.last_watched_at,
      watchCount: Number(row.watch_count),
    })),
    total: Number(data?.[0]?.total_count || 0),
  };
}

async function likedPage(
  locale: string,
  page = 1,
  type: "all" | "movie" | "tv" = "all",
  limit = PAGE_SIZE,
): Promise<ProfilePage<ProfileTitle>> {
  const { db, user } = await database();
  const start = offset(page);
  let query = db
    .from("title_likes")
    .select("media_type,tmdb_id", { count: "exact" })
    .eq("user_id", user.id);
  if (type !== "all") query = query.eq("media_type", type);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("media_type")
    .order("tmdb_id")
    .range(start, start + limit - 1);
  if (error) throw error;
  const items = await Promise.all(
    (data || []).map(async (row): Promise<ProfileTitle> => {
      const mediaType = row.media_type as "movie" | "tv";
      const detail = await cachedTitle(locale, mediaType, row.tmdb_id).catch(
        () => null,
      );
      return {
        mediaType,
        tmdbId: row.tmdb_id,
        title: detail?.title || detail?.name || `#${row.tmdb_id}`,
        posterPath: detail?.poster_path || null,
      };
    }),
  );
  return { items, total: count || 0 };
}

export async function getProfileViewingPage(
  kind: "history" | "ranking",
  period: ProfilePeriod,
  page = 1,
  type: "all" | "movie" | "tv" = "all",
): Promise<ProfilePage<ProfileHistoryItem>> {
  return viewingPage(kind, period, page, type);
}

export async function getProfileLikedPage(
  locale: string,
  page = 1,
  type: "all" | "movie" | "tv" = "all",
): Promise<ProfilePage<ProfileTitle>> {
  return likedPage(locale, page, type);
}
export async function getPrivateProfileDashboard(
  period: ProfilePeriod,
  locale: string,
) {
  const { db } = await database();
  const [history, ranking, liked, statsResult] = await Promise.all([
    viewingPage("history", "all", 1, "all", 4),
    viewingPage("ranking", period, 1, "all", 3),
    likedPage(locale, 1, "all", 4),
    db.rpc("profile_viewing_stats", { p_period: period }),
  ]);
  if (statsResult.error) throw statsResult.error;
  const stats = statsResult.data?.[0];
  return {
    history: history.items,
    ranking: ranking.items,
    liked: liked.items,
    stats: {
      movieCount: Number(stats?.movie_count || 0),
      seriesCount: Number(stats?.series_count || 0),
      genreCounts: (stats?.genre_counts || {}) as Record<string, number>,
    },
  };
}
