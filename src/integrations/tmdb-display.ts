import type { Title } from "./tmdb";
export const titleName = (item: Title) => item.title || item.name || "Untitled";
export const year = (item: Title) =>
  (item.release_date || item.first_air_date || "").slice(0, 4);
export const imageUrl = (path: string | null | undefined, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
