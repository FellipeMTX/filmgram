# Filmgram

Film and series discovery with a personal library, reviews, playlists, and a following feed. The public catalog uses TMDB. Filmgram stores its own account and social data in Supabase.

## Run locally

Use Node.js 22 and pnpm 10. Install with `pnpm install --frozen-lockfile` and copy `.env.example` to `.env.local`.

- Set `TMDB_READ_TOKEN` to a TMDB API Read Access Token for live discovery.
- Set `FILMGRAM_FIXTURES=1` for deterministic catalog data in local development. Run `pnpm dev --hostname 127.0.0.1 --port 3103` and open http://127.0.0.1:3103.
- To enable accounts locally, start Supabase with `supabase start` and copy the URL and publishable key from `supabase status` to the public Supabase variables. The local CLI may display its public key as an anon key.
- For Google login with the local database, follow the [local OAuth setup](supabase/README.md#local-google-oauth).

## Checks

Run `pnpm lint`, `pnpm typecheck` and `pnpm test:unit`. Install the Playwright browser with `pnpm exec playwright install chromium`, then run `pnpm test:e2e`. Run `pnpm test:integration` against the local Supabase stack for the database and row access tests.

Husky runs checks on staged files at commit, then typecheck, unit tests and a short Chromium flow before push. GitHub Actions runs the complete checks on pull requests into `main`.

## Deploy

Connect the repository to Vercel and use the Next.js preset. Configure `TMDB_READ_TOKEN` for Preview and Production and leave fixture mode disabled for the live catalog. Set the public Supabase URL and publishable key for each corresponding project, apply the SQL migrations, then enable the Google provider and allow each app callback. Use different Supabase projects or branches for production and preview.

Before sharing the release, check the public catalog and detail route with a live TMDB key in a private browser window. When accounts are enabled, verify Google sign-in from a detail page returns to that title.

See [the implementation plan](docs/PLANEJAMENTO.md) for product stages and the architecture.

## Interview demo

`/{locale}/entrevista` opens the shared Filmgram sign-in panel and takes users to the following feed after login. The interview account provisioned by the seed uses the same email-and-password option as other existing accounts. For the seed, use an explicitly authorized Supabase target. Provide `SUPABASE_URL`, an identical `FILMGRAM_SEED_TARGET`, a server-only `SUPABASE_SERVICE_ROLE_KEY`, and a dedicated `FILMGRAM_DEMO_PASSWORD` of at least 12 characters in the process environment.

Run `node scripts/interview-demo.mjs` after installing dependencies. The seed creates `entrevista@filmgram.example` and its demo network, then verifies the demo credentials and exact follow counts. Rerun with the same password to resume the seed. Its inserts keep existing fixture rows and it stops on conflicts with unmarked Auth accounts. Keep the server key and demo password out of Git and command output.

## People profiles

Open a cast member or a movie's director to view their public profile. For example,
`/en/person/15277` shows Jon Favreau's acting and directing credits on one page.
Profiles include available biography and personal metadata, recent released works, and a
filmography searchable by title and original title without regard to accents or case. Movie/TV
and acting/directing filters combine with search. The initial view shows two rows at the current
screen size; expand it to see more and navigate through pages. Links and filters preserve the
selected locale.

Signed-in users can rate a professional from 1 to 5 and optionally add a review and up to ten
related works. Each account has one editable rating per professional. The profile displays the
average and count across all ratings; no average is shown when there are none. Professional
reviews currently appear on the professional profile only, not in the following feed or account
profile.
