import "server-only";
import type { supabase } from "@/integrations/supabase";
import { getFeedTitle } from "@/integrations/tmdb";
import { titleName } from "@/integrations/tmdb-display";
import {
  getPrivateProfileDashboard,
  getProfileViewingPage,
  getProfileLikedPage,
} from "./queries";
import type { List } from "./ProfileMedia";
import type { ProfilePeriod } from "./types";

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;
type Search = { tab?: string; type?: string; page?: string; period?: string };

export async function getProfilePageData(
  db: Client,
  userId: string | undefined,
  username: string,
  locale: string,
  q: Search,
) {
  let query = db.from("profiles").select("id,handle,display_name,avatar_url");
  query =
    username === "me" ? query.eq("id", userId!) : query.eq("handle", username);
  const { data: profile, error: profileError } = await query.maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const profileId = profile.id;
  const own = userId === profileId;
  const period: ProfilePeriod =
    q.period === "30d" || q.period === "90d" ? q.period : "all";
  const tab = [
    "overview",
    "reviews",
    ...(own ? ["watched", "liked"] : []),
    "playlists",
  ].includes(q.tab || "")
    ? q.tab!
    : "overview";
  const type = q.type === "movie" || q.type === "tv" ? q.type : "all";
  const requestedPage = Math.max(
    1,
    Math.min(834, Number.parseInt(q.page || "1", 10) || 1),
  );
  const pageSize = 12;
  const [statsResult, followResult, dashboard] = await Promise.all([
    db.rpc("profile_stats", { p_profile_id: profile.id }),
    userId
      ? db
          .from("follows")
          .select("follower_id")
          .eq("follower_id", userId)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    own && tab === "overview"
      ? getPrivateProfileDashboard(period, locale)
      : Promise.resolve(null),
  ]);
  if (statsResult.error || followResult.error)
    throw new Error("Profile data unavailable");
  const stats = Array.isArray(statsResult.data)
    ? statsResult.data[0]
    : statsResult.data;
  const history = dashboard?.history || [];
  const liked = dashboard?.liked || [];
  let collectionPage =
    own && tab === "watched"
      ? await getProfileViewingPage("history", "all", requestedPage, type)
      : own && tab === "liked"
        ? await getProfileLikedPage(locale, requestedPage, type)
        : null;
  let page = requestedPage;
  if (collectionPage && requestedPage > 1 && !collectionPage.items.length) {
    collectionPage =
      tab === "watched"
        ? await getProfileViewingPage("history", "all", 1, type)
        : await getProfileLikedPage(locale, 1, type);
    page = 1;
  }
  async function fetchReviews(target: number) {
    return db
      .from("reviews")
      .select("id,media_type,tmdb_id,rating,body,created_at", {
        count: "exact",
      })
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(
        tab === "overview" ? 0 : (target - 1) * pageSize,
        tab === "overview" ? 1 : target * pageSize - 1,
      );
  }
  async function fetchLists(target: number) {
    let query = db
      .from("playlists")
      .select(
        "id,name,is_public,item_count:playlist_items(count),covers:playlist_items(poster_path)",
        { count: "exact" },
      )
      .eq("user_id", profileId);
    if (!own) query = query.eq("is_public", true);
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("position", { referencedTable: "covers", ascending: true })
      .limit(4, { referencedTable: "covers" })
      .range(
        tab === "overview" ? 0 : (target - 1) * pageSize,
        tab === "overview" ? 1 : target * pageSize - 1,
      );
  }
  let [reviewsResult, listsResult] = await Promise.all([
    tab === "overview" || tab === "reviews"
      ? fetchReviews(page)
      : Promise.resolve(null),
    tab === "overview" || tab === "playlists"
      ? fetchLists(page)
      : Promise.resolve(null),
  ]);
  if (
    page > 1 &&
    (reviewsResult?.status === 416 || listsResult?.status === 416)
  ) {
    page = 1;
    if (tab === "reviews") reviewsResult = await fetchReviews(page);
    if (tab === "playlists") listsResult = await fetchLists(page);
  }
  if (reviewsResult?.error || listsResult?.error)
    throw new Error("Profile data unavailable");
  const activeCount =
    tab === "reviews"
      ? reviewsResult?.count
      : tab === "playlists"
        ? listsResult?.count
        : collectionPage?.total;
  const pages = Math.max(1, Math.ceil((activeCount || 0) / pageSize));
  if (!collectionPage && page > pages) {
    page = pages;
    if (tab === "reviews") reviewsResult = await fetchReviews(page);
    if (tab === "playlists") listsResult = await fetchLists(page);
    if (reviewsResult?.error || listsResult?.error)
      throw new Error("Profile data unavailable");
  }
  const lists = (listsResult?.data || []) as unknown as List[];
  const reviews = reviewsResult?.data || [];
  const reviewData = await Promise.all(
    reviews.map(async (r) => {
      const mediaType: "tv" | "movie" = r.media_type === "tv" ? "tv" : "movie";
      let detail = null;
      try {
        detail = await getFeedTitle(locale, mediaType, r.tmdb_id);
      } catch {}
      return {
        ...r,
        mediaType,
        title: detail ? titleName(detail) : "#" + r.tmdb_id,
        posterPath: detail?.poster_path || null,
      };
    }),
  );
  const raw = collectionPage?.items || [];
  return {
    profile,
    own,
    period,
    tab,
    type,
    stats,
    followed: !!followResult.data,
    dashboard,
    history,
    liked,
    lists,
    reviewData,
    raw,
    page,
    pages,
  };
}
