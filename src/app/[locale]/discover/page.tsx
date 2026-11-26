import Link from "next/link";
import {
  getTrending,
  getTopRated,
  getDetail,
  getPopular,
  type MediaType,
  type Title,
} from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { Hero } from "@/features/catalog/Hero";
import { Shelf } from "@/features/catalog/Cards";
import { container } from "@/lib/layout";
import { getRecentViewingTitles } from "@/features/profile/queries";
export default async function Discover({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params,
    query = await searchParams,
    t = messages(locale);
  const type: "all" | MediaType =
    query.type === "movie" || query.type === "tv" ? query.type : "all";
  const [items, topRated, user, db] = await Promise.all([
    getTrending(locale, type),
    getTopRated(locale, type),
    currentUser(),
    supabase(),
  ]);
  const hero = [...items.slice(0, 3), ...topRated, ...items]
    .filter(
      (item, index, all) =>
        all.findIndex(
          (x) => x.id === item.id && x.media_type === item.media_type,
        ) === index,
    )
    .slice(0, 5);
  let watched: {
    media_type: MediaType;
    tmdb_id: number;
    media_title: string;
    poster_path: string | null;
    genre_ids: number[];
  }[] = [];
  let liked: { media_type: MediaType; tmdb_id: number }[] = [];
  let recentHistory: Awaited<ReturnType<typeof getRecentViewingTitles>> | null =
    null;
  let recentUnavailable = false;
  if (db) {
    const [{ data: likes }, { data: history }, recentResult] =
      await Promise.all([
        db.rpc(
          "most_liked_titles",
          type === "all"
            ? { p_limit: 12 }
            : { p_limit: 12, p_media_type: type },
        ),
        user
          ? db
              .from("watched")
              .select("media_type,tmdb_id,media_title,poster_path,genre_ids")
              .eq("user_id", user.id)
              .order("watched_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] }),
        user
          ? getRecentViewingTitles(db, type).then(
              (data) => ({ data, error: false }),
              () => ({ data: null, error: true }),
            )
          : Promise.resolve({ data: null, error: false }),
      ]);
    liked = (likes || []) as typeof liked;
    watched = (history || []) as typeof watched;
    recentHistory = recentResult.data;
    recentUnavailable = recentResult.error;
  }
  const genres = new Map<number, number>();
  watched.forEach((x) =>
    (x.genre_ids || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + 1)),
  );
  const watchedKeys = new Set(
    watched.map((x) => `${x.media_type}-${x.tmdb_id}`),
  );
  const recommended = items
    .filter(
      (x) =>
        !watchedKeys.has(`${x.media_type}-${x.id}`) &&
        x.genre_ids?.some((g) => genres.has(g)),
    )
    .sort(
      (a, b) =>
        (b.genre_ids || []).reduce((n, g) => n + (genres.get(g) || 0), 0) -
        (a.genre_ids || []).reduce((n, g) => n + (genres.get(g) || 0), 0),
    );
  const mostLiked = (
    await Promise.all(
      liked
        .filter((x) => type === "all" || x.media_type === type)
        .slice(0, 12)
        .map((x) =>
          getDetail(locale, x.media_type, x.tmdb_id).catch(() => null),
        ),
    )
  ).filter((x): x is Title => !!x);
  const popular = mostLiked.length < 10 ? await getPopular(locale, type) : [];
  const recent: Title[] = (recentHistory?.items || []).map((x) => ({
    id: x.tmdbId,
    media_type: x.mediaType,
    title: x.title,
    poster_path: x.posterPath,
  }));
  return (
    <main>
      <div className={container}>
        <div
          className="flex h-[62px] items-center gap-[26px] mobile:my-2 mobile:mb-5 mobile:h-auto mobile:gap-2"
          aria-label={t.mediaType}
        >
          {(
            [
              ["all", t.all],
              ["movie", t.films],
              ["tv", t.series],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              aria-current={type === value ? "page" : undefined}
              className={`flex h-full items-center border-b-2 text-sm font-bold mobile:h-[38px] mobile:flex-1 mobile:justify-center mobile:rounded-[9px] mobile:border ${type === value ? "border-primary text-button-foreground mobile:bg-primary mobile:text-filter-foreground" : "border-transparent text-filter-muted mobile:border-filter-border"}`}
              href={`/${locale}/discover?type=${value}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <Hero
        key={type}
        items={hero}
        locale={locale}
        trendingKeys={items.slice(0, 3).map((x) => `${x.media_type}-${x.id}`)}
      />
      <div className={container}>
        <Shelf
          title={t.recommended}
          items={recommended}
          locale={locale}
          empty={t.noRecommendations}
        />
        <Shelf title={t.trending} items={items.slice(0, 12)} locale={locale} />
        <Shelf
          title={t.topRated}
          items={topRated.slice(0, 12)}
          locale={locale}
        />
        <Shelf
          title={mostLiked.length >= 10 ? t.mostLiked : t.popularTmdb}
          items={mostLiked.length >= 10 ? mostLiked : popular}
          locale={locale}
        />
        <Shelf
          title={t.recent}
          items={recent}
          locale={locale}
          empty={recentUnavailable ? t.error : t.noWatched}
        />
      </div>
    </main>
  );
}
