import type { MovieVideo } from "@/integrations/tmdb";
export const movieGalleryCategories = [
  "posters",
  "images",
  "trailers",
  "extras",
] as const;
export type MovieGalleryCategory = (typeof movieGalleryCategories)[number];
export function isMovieGalleryCategory(
  value?: string,
): value is MovieGalleryCategory {
  return movieGalleryCategories.some((category) => category === value);
}
export function hasTrailerCategory(videos: MovieVideo[]) {
  return videos.filter((video) => video.type === "Trailer").length > 3;
}
