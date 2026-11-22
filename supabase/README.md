# Local database

Install the Supabase CLI and run a Docker-compatible daemon. From the repository root run `supabase start`, then `supabase db reset` to apply the migration, and `supabase test db` to run the pgTAP policy tests. The local API URL and anon key are printed by `supabase status`; use only the anon key in a browser. To regenerate the TypeScript contract after schema changes, run `supabase gen types typescript --local > src/types/database.generated.ts`.

Favorites and watched entries are private. Like rows are private; use `title_like_count` for public totals. `profile_stats` publicly exposes aggregate movie, series, and genre counts from watched entries, but not individual watched rows. Playlist positions are zero-based. Call `reorder_playlist_items` with every item ID exactly once in the desired order; it validates ownership and updates the list in one transaction.
