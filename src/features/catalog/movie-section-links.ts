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
