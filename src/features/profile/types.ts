export type ProfilePeriod = "all" | "30d" | "90d";
export type ProfileTitle = {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  posterPath: string | null;
};
export type ProfileHistoryItem = ProfileTitle & {
  lastWatchedAt: string;
  watchCount: number;
};
export type ProfileRankingItem = ProfileHistoryItem;
export type ProfilePage<T> = { items: T[]; total: number };

export type ProfileTab =
  "overview" | "reviews" | "watched" | "liked" | "playlists";
export function profileTabs(own: boolean): ProfileTab[] {
  return own
    ? ["overview", "reviews", "watched", "liked", "playlists"]
    : ["overview", "reviews", "playlists"];
}

export type ProfilePlaylist = {
  id: string;
  name: string;
  isPublic: boolean;
  itemCount: number;
  posterPaths: (string | null)[];
};
