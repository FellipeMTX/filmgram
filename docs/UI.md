# Filmgram UI

The UI uses Tailwind CSS 4 and shadcn/ui components from `src/components/ui`.
`components.json` configures the shadcn registry and aliases. Components are local source code;
review registry updates before replacing Filmgram customizations.

## Visual identity and future themes

The existing dark theme remains the default. Semantic CSS variables in
`src/app/globals.css` define surfaces, foregrounds, borders, focus rings and the coral accent.
Tailwind maps those roles through `@theme inline`. A future theme can override the variables
without changing component classes. No theme switcher or light theme is introduced by this migration.
Keep DM Sans, Oswald, existing spacing and the 700px/900px layout thresholds unless a design change is requested.

Use shared layout constants in `src/lib/layout.ts` and `cn` in `src/lib/utils.ts`.
Prefer semantic color utilities over literal colors. Image overlays and flag artwork have
fixed colors where their meaning is independent of the surrounding theme.
CSS outside Tailwind is reserved for tokens, base styles and specialized animation rules.

## Composition and behavior

Use the adapted shadcn Button, Input, Textarea, NativeSelect, Card and other primitives
where applicable. Product components such as Hero, Rail and TitleCard remain Filmgram
compositions; avoid introducing unrelated carousel behavior or navigation semantics.
Navigation between routes remains links, not ARIA tabs for in-page panels.

Preserve Server Component boundaries. Interactive controls can be small Client Components;
do not move data access or secrets into them. Preserve form field names, hidden fields,
required/default values and explicit submit types. Native checkbox submission must omit
`is_public` when unchecked because the server action uses `FormData.has`.

Hero autoplay measures 6000ms of active time. Hover, focus, hidden pages and reduced-motion preference suspend progression.
Manual slide selection resets progress. The dot controls are siblings of the banner link,
and the synopsis uses the available width with justified text.

## Verification

Run lint, typecheck and unit tests. Run database integration and Playwright tests with the
local Supabase instance for account flows. Build and browser checks should run sequentially:
Next dev instances in one checkout share a lock. Visual checks use fixture catalog data,
reduced motion or a controlled clock, and matching viewports to compare the baseline.

## Migration verification (2026-11-23)

- Lint and typecheck passed; lint retains the two pre-existing `no-img-element` warnings.
- 20 unit tests and 35 database policy tests passed.
- Production build passed; Playwright passed 45 tests with 5 device-specific skips.
- Captured 23 before/after screenshots across 390px, 768px and 1650px layouts,
  with additional locale captures. Browser assertions cover 320/700/701/768/900/1650px.
- Sol review confirmed visible focus above hero artwork, reduced-motion behavior,
  accessible language option names and unchanged Server Action contracts.
- Theme switching remains a future feature; only semantic token infrastructure ships here.

## Local development origin

`next.config.ts` explicitly allows `127.0.0.1` for development assets. The development
server binds to `0.0.0.0` for WSL access, while the app is opened through loopback.
Without this exact allowlist entry, Next may block dev assets requested by the integrated
browser and leave server-rendered controls unhydrated. No wildcard origin is permitted.

## Professional profiles

Public profiles live at `/{locale}/person/{id}` and use the same dark visual system as title pages.
Cast links and the movie-only Direction section reuse PersonCard. Directors are identified by
`credits.crew[].job === "Director"`, including co-directors, without additional person requests
while rendering a title. A person who acts and directs has one shared profile.

Person details and combined credits are requested server-side and cached for one hour. HTTP 404
maps to the not-found page; other upstream errors reach the existing error boundary. Optional
metadata, unavailable portraits, biography gaps and invalid dates have explicit fallbacks.

Filmography combines cast and crew by `(media_type, id)`, preserving complete character strings
and distinct jobs. Acting and directing are derived from the actual credits, not the person's
primary department. Films use release date and series use first-air date for sorting; unknown
dates are last and ties are stable. Future dates are labeled below cards without overlapping badges.

The `type` and `activity` URL filters are applied before pagination (24 works). Changing a filter
resets the page; invalid values fall back and out-of-range page numbers are clamped. The count
represents distinct matching works reported by TMDB, not a guarantee of complete career coverage.
The mobile layout keeps the portrait visible and places the biography at full content width.

Tests include real sample people and movie credits, plus a clearly named synthetic pagination
profile (90000001) available only when `FILMGRAM_FIXTURES=1`.
