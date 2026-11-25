import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { imageUrl } from "@/integrations/tmdb-display";
import { profileLabels } from "./labels";
import type { getPrivateProfileDashboard } from "./queries";
const heading =
  "font-display text-[28px] leading-tight font-semibold text-heading";
const genres: Record<number, [string, string, string]> = {
  28: ["Action", "Ação", "Acción"],
  12: ["Adventure", "Aventura", "Aventura"],
  16: ["Animation", "Animação", "Animación"],
  35: ["Comedy", "Comédia", "Comedia"],
  80: ["Crime", "Crime", "Crimen"],
  99: ["Documentary", "Documentário", "Documental"],
  18: ["Drama", "Drama", "Drama"],
  10751: ["Family", "Família", "Familia"],
  14: ["Fantasy", "Fantasia", "Fantasía"],
  27: ["Horror", "Terror", "Terror"],
  9648: ["Mystery", "Mistério", "Misterio"],
  10749: ["Romance", "Romance", "Romance"],
  878: ["Science fiction", "Ficção científica", "Ciencia ficción"],
  53: ["Thriller", "Suspense", "Suspenso"],
  36: ["History", "História", "Historia"],
  10402: ["Music", "Música", "Música"],
  10752: ["War", "Guerra", "Bélica"],
  10770: ["TV Movie", "Cinema TV", "Película de TV"],
  37: ["Western", "Faroeste", "Western"],
  10762: ["Kids", "Infantil", "Infantil"],
  10763: ["News", "Notícias", "Noticias"],
  10764: ["Reality", "Reality", "Telerrealidad"],
  10766: ["Soap", "Novela", "Telenovela"],
  10767: ["Talk", "Talk show", "Entrevistas"],
  10768: ["War & Politics", "Guerra e política", "Guerra y política"],
  10759: ["Action & Adventure", "Ação e aventura", "Acción y aventura"],
  10765: [
    "Sci-Fi & Fantasy",
    "Ficção científica e fantasia",
    "Ciencia ficción y fantasía",
  ],
};

type Dashboard = Awaited<ReturnType<typeof getPrivateProfileDashboard>>;
export function ProfileHabits({
  locale,
  own,
  period,
  dashboard,
  stats,
}: {
  locale: string;
  own: boolean;
  period: "all" | "30d" | "90d";
  dashboard: Dashboard | null;
  stats: {
    movie_count?: number;
    series_count?: number;
    genre_counts?: unknown;
  } | null;
}) {
  const l = profileLabels(locale);
  const counts = dashboard?.stats || {
    movieCount: Number(stats?.movie_count || 0),
    seriesCount: Number(stats?.series_count || 0),
    genreCounts: (stats?.genre_counts || {}) as Record<string, number>,
  };
  const total = counts.movieCount + counts.seriesCount;
  const moviePercent = total
    ? Math.round((counts.movieCount / total) * 100)
    : 0;
  const seriesPercent = total ? 100 - moviePercent : 0;
  const top = Object.entries(counts.genreCounts)
    .map(([id, n]) => [Number(id), Number(n)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const lang = locale === "pt-BR" ? 1 : locale === "es" ? 2 : 0;
  return (
    <aside className="min-w-0 border-l border-border pl-6 compact:border-l-0 compact:border-t compact:pt-6 compact:pl-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className={heading}>{l.habits}</h2>
        {own && (
          <form className="flex items-center gap-2">
            <input type="hidden" name="tab" value="overview" />
            <label className="sr-only" htmlFor="period">
              {l.period}
            </label>
            <NativeSelect
              id="period"
              name="period"
              defaultValue={period}
              size="sm"
            >
              <NativeSelectOption value="all">{l.allTime}</NativeSelectOption>
              <NativeSelectOption value="30d">{l.days30}</NativeSelectOption>
              <NativeSelectOption value="90d">{l.days90}</NativeSelectOption>
            </NativeSelect>
            <Button type="submit" variant="outline" size="sm">
              {l.apply}
            </Button>
          </form>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div>
          <strong className="block font-display text-4xl">
            {counts.movieCount}
          </strong>
          {l.films}
        </div>
        <div className="pl-6">
          <strong className="block font-display text-4xl">
            {counts.seriesCount}
          </strong>
          {l.series}
        </div>
      </div>
      <div className="mt-5 h-4 overflow-hidden rounded-md bg-muted">
        <div
          className="h-full bg-primary"
          style={{
            width: (total ? (counts.movieCount / total) * 100 : 0) + "%",
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span>
          {moviePercent}% {l.films.toLowerCase()}
        </span>
        <span>
          {seriesPercent}% {l.series.toLowerCase()}
        </span>
      </div>
      <section className="mt-6 border-t border-border pt-4">
        <h3 className={heading}>{l.genres}</h3>
        {top.length ? (
          top.map(([id, n]) => (
            <div key={id} className="mt-3">
              <div className="flex justify-between text-sm">
                <span>{genres[id]?.[lang] || "#" + id}</span>
                <span>{n}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width:
                      Math.min(100, (n / Math.max(top[0]?.[1] || 1, 1)) * 100) +
                      "%",
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="mt-3 text-subtle">{l.emptyGenres}</p>
        )}
      </section>
      {own && (
        <section className="mt-6 border-t border-border pt-4">
          <h3 className={heading}>{l.revisited}</h3>
          {dashboard?.ranking.length ? (
            dashboard.ranking.slice(0, 4).map((item, i) => (
              <Link
                key={item.mediaType + "-" + item.tmdbId}
                href={
                  "/" + locale + "/title/" + item.mediaType + "/" + item.tmdbId
                }
                className="flex items-center gap-4 border-b border-border py-3 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="text-primary">{i + 1}</span>
                <div className="h-14 w-16 overflow-hidden rounded bg-secondary">
                  {item.posterPath && (
                    <Image
                      src={imageUrl(item.posterPath, "w185")!}
                      width={64}
                      height={56}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-subtle">
                    {item.watchCount} {l.views}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="mt-3 text-subtle">{l.emptyRevisited}</p>
          )}
        </section>
      )}
    </aside>
  );
}
