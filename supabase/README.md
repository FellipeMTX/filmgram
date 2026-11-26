# Local database

Install the Supabase CLI and run a Docker-compatible daemon. From the repository root run `supabase start`, then `supabase migration up --local` to apply pending migrations without resetting local data, and `supabase test db --local` to run the pgTAP policy tests. The local API URL and anon key are printed by `supabase status`; use only the anon key in a browser. To regenerate the TypeScript contract after schema changes, run `supabase gen types typescript --local > src/types/database.generated.ts`.

The consolidated baseline is for new databases. For an existing database, first
apply any pending legacy migrations from commit `524af7a`. Verify the database
matches the pre-consolidation schema and back it up before reconciling its
migration history with the baseline. Running the baseline SQL on the existing
schema will fail.

## Production migrations

Set the GitHub Actions repository secret `SUPABASE_DB_URL` to the production
Supabase Session pooler connection string. Percent-encode special characters in
the database password. On `main`, the **CI** workflow applies pending
migrations after verification passes. Configure Vercel's production Deployment
Checks to require **CI / verify** and **CI / Apply production migrations** before
promoting the build.

For future releases, add schema changes with `supabase migration new` and keep
them compatible with the currently deployed application until the new build is
promoted.

Favorites and watched entries are private. Like rows are private; use `title_like_count` for public totals. `profile_stats` publicly exposes aggregate movie, series, and genre counts from watched entries, but not individual watched rows. Playlist positions are zero-based. Use `append_playlist_item`, `remove_playlist_item`, and `reorder_playlist_items` for changes; direct item writes are disabled. Reordering requires both the full desired order and the order observed by the caller, so stale updates are rejected. All three operations lock the playlist and verify ownership.

Set `APP_ORIGIN` to the canonical application origin (HTTPS in production). Local development defaults to `http://127.0.0.1:3103`. Add the corresponding `/auth/callback` URL to the Supabase Auth redirect allowlist for each deployment. Google authentication remains disabled until provider credentials are configured. Existing profile handles are not automatically rewritten because custom handles cannot be reliably distinguished from generated ones.

## Local Google OAuth

1. Create a separate Google OAuth Web client for development. Set the authorized JavaScript origin to `http://127.0.0.1:3103` and the authorized redirect URI to `http://127.0.0.1:54321/auth/v1/callback`.
2. In the Git-ignored `supabase/.env.local`, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` to enable the local provider and supply that client's credentials.
3. From the repository root, run `supabase stop` followed by `supabase start` to load the provider settings and retain the local database. Open the app at `http://127.0.0.1:3103`, which matches the allowed app callback.

With Supabase CLI 2.39.2, use a separate checkout for linked deployment commands if that link makes local startup select incompatible hosted service images. To run just the Filmgram services when Realtime or Analytics fails locally, use `supabase start -x realtime,logflare,vector`.

## Professional reviews

The schema includes `person_reviews` and `person_review_works` independently of title reviews.
The parent table enforces one review per account and professional, a required rating from 0
to 10, and an optional body of at most 10,000 characters. Related movie/TV IDs are optional,
unique per review, and limited to ten positions. The public `person_rating_stats` function
computes the average and count over all reviews; the average is null when there are none.

Rows are publicly readable; authenticated writes are restricted to the owner, including child
rows. `save_person_review` uses the authenticated identity and saves a review and its references
atomically. Its expected update timestamp detects stale app edits; direct child writes outside
the RPC do not update that timestamp. The server action checks new references against current
TMDB credits and retains existing references that have since disappeared until the user removes
them. The database cannot independently verify TMDB membership for direct authenticated writes,
so consumers must resolve references against current credits before displaying work details.
Professional reviews are not included in the following feed or account-profile review list.
