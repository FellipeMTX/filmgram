import Link from "next/link";
import {
  getTrending,
  getTopRated,
  getDetail,
  imageUrl,
  titleName,
  year,
  type MediaType,
  type Title,
} from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { Shelf } from "@/features/catalog/Cards";
import styles from "./page.module.css";
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
  const hero = items[0];
  let watched: {
    media_type: MediaType;
    tmdb_id: number;
    media_title: string;
    poster_path: string | null;
    genre_ids: number[];
  }[] = [];
  let liked: { media_type: MediaType; tmdb_id: number }[] = [];
  if (db) {
    const [{ data: likes }, { data: history }] = await Promise.all([
      db.rpc("most_liked_titles", { p_limit: 12 }),
      user
        ? db
            .from("watched")
            .select("media_type,tmdb_id,media_title,poster_path,genre_ids")
            .eq("user_id", user.id)
            .order("watched_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
    ]);
    liked = (likes || []) as typeof liked;
    watched = (history || []) as typeof watched;
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
  const recent: Title[] = watched
    .filter((x) => type === "all" || x.media_type === type)
    .map((x) => ({
      id: x.tmdb_id,
      media_type: x.media_type,
      title: x.media_title,
      poster_path: x.poster_path,
      genre_ids: x.genre_ids,
    }));
  return (
    <main>
      <div className="container">
        <div className={styles.filter} aria-label={t.mediaType}>
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
              className={type === value ? styles.selected : ""}
              href={`/${locale}/discover?type=${value}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      {hero ? (
        <section
          className={styles.hero}
          style={{
            backgroundImage: `linear-gradient(90deg,#100e0d 2%,#100e0dbb 38%,#100e0d18 80%),linear-gradient(0deg,#100e0d 0%,transparent 42%),url(${imageUrl(hero.backdrop_path, "original") || ""})`,
          }}
        >
          <div className={`${styles.heroInner} container`}>
            <p className="eyebrow">✦ &nbsp; {t.trendingToday}</p>
            <h1>{titleName(hero)}</h1>
            <p className={styles.heroMeta}>
              {hero.media_type === "movie" ? t.film : t.seriesOne} <i>·</i>{" "}
              {year(hero) || "—"} <i>·</i> <span>★</span>{" "}
              {hero.vote_average?.toFixed(1) || "—"} TMDB
            </p>
            <p className={styles.overview}>{hero.overview}</p>
            <Link
              className="button primary"
              href={`/${locale}/title/${hero.media_type}/${hero.id}`}
            >
              {t.viewDetails} <span>↗</span>
            </Link>
          </div>
        </section>
      ) : (
        <p className="container muted">{t.noResults}</p>
      )}
      <div className="container">
        <Shelf
          title={t.recommended}
          items={recommended}
          locale={locale}
          empty={t.noRecommendations}
        />
        <Shelf title={t.trending} items={items} locale={locale} />
        <Shelf title={t.topRated} items={topRated} locale={locale} />
        <Shelf title={t.mostLiked} items={mostLiked} locale={locale} />
        <Shelf
          title={t.recent}
          items={recent}
          locale={locale}
          empty={t.noWatched}
        />
      </div>
      <footer className="footer container">
        FILMGRAM <span>·</span> {t.tagline} <small>{t.attribution}</small>
      </footer>
    </main>
  );
}
