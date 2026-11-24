import { imageUrl } from "@/integrations/tmdb-display";
import {
  getMovieReleases,
  getMovieVideos,
  getMovieWatchProviders,
  getMovieReleaseCountries,
  getMovieProviderCountries,
  movieRegion,
} from "@/integrations/tmdb";
import { MovieVideos } from "./MovieVideos";
import { MovieCountrySelect } from "./MovieCountrySelect";
import Image from "next/image";

const labels = {
  en: {
    country: "Country",
    apply: "Show",
    releases: "Release dates",
    videos: "Videos",
    watch: "Where to watch",
    noReleases: "No release dates are available for this country.",
    noVideos: "No videos are available.",
    noWatch: "No streaming information is available for this country.",
    error: "This information is temporarily unavailable.",
    attribution: "Streaming information provided by JustWatch.",
    providerLink: "See availability on TMDB",
    types: [
      "",
      "Premiere",
      "Theatrical (limited)",
      "Theatrical",
      "Digital",
      "Physical",
      "TV",
    ],
    groups: {
      flatrate: "Stream",
      rent: "Rent",
      buy: "Buy",
      ads: "With ads",
      free: "Free",
    },
  },
  "pt-BR": {
    country: "País",
    apply: "Mostrar",
    releases: "Lançamentos",
    videos: "Vídeos",
    watch: "Onde assistir",
    noReleases: "Não há datas de lançamento disponíveis para este país.",
    noVideos: "Não há vídeos disponíveis.",
    noWatch: "Não há informações de streaming disponíveis para este país.",
    error: "Estas informações estão temporariamente indisponíveis.",
    attribution: "Informações de streaming fornecidas por JustWatch.",
    providerLink: "Ver disponibilidade no TMDB",
    types: [
      "",
      "Estreia",
      "Cinema (limitado)",
      "Cinema",
      "Digital",
      "Mídia física",
      "TV",
    ],
    groups: {
      flatrate: "Streaming",
      rent: "Alugar",
      buy: "Comprar",
      ads: "Com anúncios",
      free: "Grátis",
    },
  },
  es: {
    country: "País",
    apply: "Mostrar",
    releases: "Estrenos",
    videos: "Vídeos",
    watch: "Dónde ver",
    noReleases: "No hay fechas de estreno disponibles para este país.",
    noVideos: "No hay vídeos disponibles.",
    noWatch: "No hay información de streaming disponible para este país.",
    error: "Esta información no está disponible temporalmente.",
    attribution: "Información de streaming proporcionada por JustWatch.",
    providerLink: "Ver disponibilidad en TMDB",
    types: [
      "",
      "Estreno",
      "Cine (limitado)",
      "Cine",
      "Digital",
      "Formato físico",
      "TV",
    ],
    groups: {
      flatrate: "Streaming",
      rent: "Alquilar",
      buy: "Comprar",
      ads: "Con anuncios",
      free: "Gratis",
    },
  },
};
export async function MovieExtraPanel({
  tab,
  locale,
  id,
  country,
}: {
  tab: "releases" | "videos" | "watch";
  locale: string;
  id: number;
  country?: string;
}) {
  const l = labels[locale as keyof typeof labels] || labels.en;
  const region = movieRegion(locale, country);
  const regions =
    tab === "videos"
      ? []
      : await (
          tab === "releases"
            ? getMovieReleaseCountries(locale, id)
            : getMovieProviderCountries(locale, id)
        ).catch(() => []);
  const selector = (
    <MovieCountrySelect
      label={l.country}
      locale={locale}
      id={id}
      tab={tab}
      region={region}
      regions={[...new Set([region, ...regions])]}
    />
  );
  const result = await (
    tab === "releases"
      ? getMovieReleases(locale, id, region)
      : tab === "videos"
        ? getMovieVideos(locale, id)
        : getMovieWatchProviders(locale, id, region)
  ).then(
    (value) => ({ value, failed: false as const }),
    () => ({ value: null, failed: true as const }),
  );
  if (result.failed)
    return (
      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">{l[tab]}</h2>
        {tab !== "videos" && selector}
        <p role="alert" className="text-muted-foreground">
          {l.error}
        </p>
        {tab === "watch" && (
          <p className="mt-4 text-sm text-muted-foreground">{l.attribution}</p>
        )}
      </section>
    );
  if (tab === "releases") {
    const dates = result.value as Awaited<ReturnType<typeof getMovieReleases>>;
    return (
      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">
          {l.releases}
        </h2>
        {selector}
        {dates.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {dates.map((entry, index) => (
              <li
                key={`${entry.date}-${entry.type}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4"
              >
                <time dateTime={entry.date}>
                  {new Date(entry.date).toLocaleDateString(locale, {
                    timeZone: "UTC",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <span className="text-sm text-muted-foreground">
                  {l.types[entry.type] || ""}
                  {entry.certification ? ` · ${entry.certification}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{l.noReleases}</p>
        )}
      </section>
    );
  }
  if (tab === "videos") {
    const videos = result.value as Awaited<ReturnType<typeof getMovieVideos>>;
    return (
      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">{l.videos}</h2>
        {videos.length ? (
          <MovieVideos videos={videos} locale={locale} />
        ) : (
          <p className="text-muted-foreground">{l.noVideos}</p>
        )}
      </section>
    );
  }
  const data = result.value as Awaited<
    ReturnType<typeof getMovieWatchProviders>
  >;
  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-semibold">{l.watch}</h2>
      {selector}
      {data &&
      Object.keys(l.groups).some(
        (key) => data[key as keyof typeof l.groups].length,
      ) ? (
        <div className="space-y-5">
          {(Object.keys(l.groups) as (keyof typeof l.groups)[]).map(
            (key) =>
              data[key].length > 0 && (
                <div key={key}>
                  <h3 className="mb-2 font-bold">{l.groups[key]}</h3>
                  <ul className="flex flex-wrap gap-3">
                    {data[key].map((provider) => (
                      <li
                        key={provider.provider_id}
                        className="flex w-28 flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center text-sm"
                      >
                        {provider.logo_path && (
                          <Image
                            src={imageUrl(provider.logo_path, "w185")!}
                            alt=""
                            width={56}
                            height={56}
                            unoptimized
                            className="size-14 rounded-md object-cover"
                          />
                        )}
                        <span>{provider.provider_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">{l.noWatch}</p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        {l.attribution}{" "}
        {data?.link && (
          <a
            className="text-primary hover:underline"
            href={data.link}
            target="_blank"
            rel="noreferrer"
          >
            {l.providerLink} ↗
          </a>
        )}
      </p>
    </section>
  );
}
