import "server-only";
import { supabase } from "@/integrations/supabase";
import { getFeedTitle, type MediaType } from "@/integrations/tmdb";
import { isLocale } from "@/i18n/messages";
import { z } from "zod";

const cursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.guid(),
});
export type Cursor = z.infer<typeof cursorSchema>;
export type FeedItem = {
  id: string;
  media_type: string;
  tmdb_id: number;
  rating: number;
  body: string | null;
  youtube_video_id: string | null;
  created_at: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  title: string | null;
  poster: string | null;
  year: string | null;
};
export type FeedPage = { items: FeedItem[]; next: Cursor | null };

export async function getFeed(
  locale: string,
  cursor?: Cursor,
): Promise<FeedPage> {
  if (!isLocale(locale)) throw new Error("Invalid locale");
  if (cursor !== undefined) cursorSchema.parse(cursor);
  const db = await supabase();
  if (!db) throw new Error("Database unavailable");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data, error } = await db.rpc(
    "following_feed",
    cursor
      ? {
          p_before_created_at: cursor.createdAt,
          p_before_id: cursor.id,
        }
      : {},
  );
  if (error) throw error;
  const rows = data.slice(0, 12);
  const keyOf = (row: (typeof rows)[number]) =>
    `${row.media_type}:${row.tmdb_id}`;
  const uniqueTitles = [
    ...new Map(rows.map((row) => [keyOf(row), row])).values(),
  ];
  const metadata = new Map<string, Awaited<ReturnType<typeof getFeedTitle>>>();
  const concurrency = 4;
  for (let start = 0; start < uniqueTitles.length; start += concurrency) {
    await Promise.all(
      uniqueTitles.slice(start, start + concurrency).map(async (row) => {
        const title = await getFeedTitle(
          locale,
          row.media_type as MediaType,
          row.tmdb_id,
        ).catch(() => null);
        metadata.set(keyOf(row), title);
      }),
    );
  }
  const items = rows.map((row) => {
    const title = metadata.get(keyOf(row));
    return {
      ...row,
      title: title?.title || title?.name || null,
      poster: title?.poster_path || null,
      year:
        (title?.release_date || title?.first_air_date || "").slice(0, 4) ||
        null,
    };
  });
  const last = rows.at(-1);
  return {
    items,
    next:
      data.length > 12 && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}
