# Local database

Install the Supabase CLI and run a Docker-compatible daemon. From the repository root run `supabase start`, then `supabase db reset --local` to apply the migration, and `supabase test db --local` to run the pgTAP policy tests. The local API URL and anon key are printed by `supabase status`; use only the anon key in a browser. To regenerate the TypeScript contract after schema changes, run `supabase gen types typescript --local > src/types/database.generated.ts`.

Favorites and watched entries are private. Like rows are private; use `title_like_count` for public totals. `profile_stats` publicly exposes aggregate movie, series, and genre counts from watched entries, but not individual watched rows. Playlist positions are zero-based. Use `append_playlist_item`, `remove_playlist_item`, and `reorder_playlist_items` for changes; direct item writes are disabled. Reordering requires both the full desired order and the order observed by the caller, so stale updates are rejected. All three operations lock the playlist and verify ownership.

Set `APP_ORIGIN` to the canonical application origin (HTTPS in production). Local development defaults to `http://127.0.0.1:3103`. Add the corresponding `/auth/callback` URL to the Supabase Auth redirect allowlist for each deployment. Google authentication remains disabled until provider credentials are configured. Existing profile handles are not automatically rewritten because custom handles cannot be reliably distinguished from generated ones.

## Local Google OAuth

1. Create a separate Google OAuth Web client for development. Set the authorized JavaScript origin to `http://127.0.0.1:3103` and the authorized redirect URI to `http://127.0.0.1:54321/auth/v1/callback`.
2. In the Git-ignored `supabase/.env.local`, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` to enable the local provider and supply that client's credentials.
3. From the repository root, run `supabase stop` followed by `supabase start` to load the provider settings and retain the local database. Open the app at `http://127.0.0.1:3103`, which matches the allowed app callback.

With Supabase CLI 2.39.2, use a separate checkout for linked deployment commands if that link makes local startup select incompatible hosted service images. To run just the Filmgram services when Realtime or Analytics fails locally, use `supabase start -x realtime,logflare,vector`.
