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
