const legacySections: Record<string, string> = {
  overview: "film-details",
  crew: "cast-and-crew",
  releases: "releases",
  videos: "videos",
  watch: "where-to-watch",
  reviews: "reviews",
};

export function legacyMovieSection(tab: string | null) {
  return tab && Object.hasOwn(legacySections, tab) ? legacySections[tab] : null;
}

export function movieReviewId(value?: string | null) {
  return value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function titleReviewHref(base: string, review: string) {
  const [pathAndQuery = ""] = base.split("#", 1);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("review", review);
  return path + "?" + params.toString() + "#review-" + review;
}

export function movieHref(
  base: string,
  options: { country?: string; tab?: string; media?: string } = {},
) {
  const query = new URLSearchParams();
  for (const key of ["country", "tab", "media"] as const) {
    if (options[key]) query.set(key, options[key]!);
  }
  const suffix = query.toString();
  return base + (suffix ? "?" + suffix : "");
}
type MovieTab = "overview" | "info" | "reviews" | "gallery";

const infoSections = new Set([
  "cast-and-crew",
  "film-details",
  "releases",
  "where-to-watch",
]);
const tabs = new Set(["info", "reviews", "gallery"]);

export function resolveMovieLocation({
  tab,
  review,
  fragment = "",
}: {
  tab?: string | null;
  review?: string | null;
  fragment?: string;
}) {
  const reviewFragment = fragment.startsWith("review-");
  const reviewId = movieReviewId(
    review ?? (reviewFragment ? fragment.slice(7) : null),
  );
  const legacyTarget = legacyMovieSection(tab ?? null);
  const sectionTab =
    review != null || reviewFragment || fragment === "reviews"
      ? "reviews"
      : infoSections.has(fragment) ||
          (legacyTarget && infoSections.has(legacyTarget))
        ? "info"
        : null;
  const active: MovieTab =
    sectionTab ?? (tab && tabs.has(tab) ? (tab as MovieTab) : "overview");
  const target = reviewId
    ? "review-" + reviewId
    : review != null || reviewFragment
      ? "reviews"
      : fragment || (tab !== "reviews" ? legacyTarget : null);
  return {
    active,
    target,
    reviewId,
    tabReplacement: sectionTab && tab !== sectionTab ? sectionTab : null,
    saveReviewQuery: review == null && reviewFragment && !!reviewId,
    legacyTarget,
  };
}

export function movieCategory(media?: string) {
  return media === "posters" ||
    media === "images" ||
    media === "extras" ||
    media === "trailers"
    ? media
    : undefined;
}

export function movieHeroRelease<T extends { type: number }>(
  releases: T[],
): T | undefined {
  return (
    releases.find((entry) => entry.type === 3) ||
    releases.find((entry) => entry.type === 2) ||
    releases[0]
  );
}
