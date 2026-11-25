import { Suspense } from "react";
import Image from "next/image";
import { imageUrl } from "@/integrations/tmdb-display";
import {
  getMovieReleases,
  getMovieWatchProviders,
  getMovieReleaseCountries,
  getMovieProviderCountries,
  movieRegion,
} from "@/integrations/tmdb";
import { MovieCountrySelect } from "./MovieCountrySelect";

const labels = {
  en: {
    country: "Availability and release country",
    releases: "Release dates",
    watch: "Where to watch",
    noReleases: "No release dates are available for this country.",
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
      flatrate: "Streaming",
      rent: "Rent",
      buy: "Buy",
      ads: "With ads",
      free: "Free",
    },
  },
  "pt-BR": {
    country: "País de disponibilidade e lançamentos",
    releases: "Lançamentos",
    watch: "Onde assistir",
    noReleases: "Não há datas de lançamento disponíveis para este país.",
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
      rent: "Aluguel",
      buy: "Compra",
      ads: "Com anúncios",
      free: "Grátis",
    },
  },
  es: {
    country: "País de disponibilidad y estrenos",
    releases: "Estrenos",
    watch: "Dónde ver",
    noReleases: "No hay fechas de estreno disponibles para este país.",
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
      rent: "Alquiler",
      buy: "Compra",
      ads: "Con anuncios",
      free: "Gratis",
    },
  },
};

type ExtraLabels = (typeof labels)[keyof typeof labels];

async function RegionPicker({
  locale,
  region,
  id,
  label,
}: {
  locale: string;
  region: string;
  id: number;
  label: string;
}) {
  const [providers, releases] = await Promise.all([
    getMovieProviderCountries(locale, id).catch(() => []),
    getMovieReleaseCountries(locale, id).catch(() => []),
  ]);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  const regions = [...new Set([region, ...providers, ...releases])]
    .map((value) => ({ value, label: names.of(value) || value }))
    .sort((a, b) => collator.compare(a.label, b.label));
  return <MovieCountrySelect label={label} region={region} regions={regions} />;
}

async function WatchProviders({
  locale,
  id,
  region,
  text,
}: {
  locale: string;
  id: number;
  region: string;
  text: ExtraLabels;
}) {
  const result = await getMovieWatchProviders(locale, id, region).then(
    (data) => ({ data, failed: false }),
    () => ({ data: null, failed: true }),
  );
  const data = result.data;
  const rows = data
    ? (Object.keys(text.groups) as (keyof ExtraLabels["groups"])[]).flatMap(
        (mode) => data[mode].map((provider) => ({ provider, mode })),
      )
    : [];

  return (
    <>
      {result.failed ? (
        <p role="alert" className="text-sm text-subtle">
          {text.error}
        </p>
      ) : rows.length ? (
        <ul className="divide-y divide-border text-sm">
          {rows.map(({ provider, mode }) => {
            const logo = imageUrl(provider.logo_path, "w185");
            return (
              <li
                key={mode + ":" + provider.provider_id}
                className="grid grid-cols-[1.55rem_minmax(0,1fr)_auto] items-center gap-2.5 py-2"
              >
                <span aria-hidden="true">
                  {logo && (
                    <Image
                      src={logo}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                      className="size-6 rounded object-cover"
                    />
                  )}
                </span>
                <span className="font-semibold [overflow-wrap:anywhere]">
                  {provider.provider_name}
                </span>
                <span className="text-right text-subtle">
                  {text.groups[mode]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-subtle">{text.noWatch}</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        {text.attribution}{" "}
      </p>
    </>
  );
}

async function ReleaseDates({
  locale,
  id,
  region,
  text,
}: {
  locale: string;
  id: number;
  region: string;
  text: ExtraLabels;
}) {
  const dates = await getMovieReleases(locale, id, region).catch(() => null);
  if (!dates)
    return (
      <p role="alert" className="text-sm text-subtle">
        {text.error}
      </p>
    );
  if (!dates.length)
    return <p className="text-sm text-subtle">{text.noReleases}</p>;
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    dateStyle: "long",
  });
  const country =
    new Intl.DisplayNames([locale], { type: "region" }).of(region) || region;
  return (
    <ul className="divide-y divide-border">
      {dates.map((entry, index) => (
        <li
          key={[entry.date, entry.type, index].join("-")}
          className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
        >
          <time dateTime={entry.date} className="font-semibold">
            {formatter.format(new Date(entry.date))}{" "}
            <span className="font-normal">({country})</span>
          </time>
          <span className="flex items-center gap-2 text-subtle">
            {text.types[entry.type]}
            {entry.certification && (
              <strong className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                {entry.certification}
              </strong>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MovieExtraPanel({
  locale,
  id,
  country,
  loading,
  watchOnly = false,
}: {
  watchOnly?: boolean;
  locale: string;
  id: number;
  country?: string;
  loading: string;
}) {
  const text = labels[locale as keyof typeof labels] || labels.en;
  const region = movieRegion(locale, country);
  const heading =
    "font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight font-bold";
  const fallback = (
    <p role="status" className="text-sm text-subtle">
      {loading}
    </p>
  );
  return (
    <>
      <section
        id="where-to-watch"
        aria-labelledby="movie-watch-heading"
        className="scroll-mt-4"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="movie-watch-heading" className={heading}>
            {text.watch}
          </h2>
          <Suspense fallback={null}>
            <RegionPicker
              locale={locale}
              region={region}
              id={id}
              label={text.country}
            />
          </Suspense>
        </div>
        <Suspense fallback={fallback}>
          <WatchProviders locale={locale} region={region} id={id} text={text} />
        </Suspense>
      </section>
      {!watchOnly && (
        <section
          id="releases"
          aria-labelledby="movie-release-heading"
          className="scroll-mt-4 border-t border-border pt-4"
        >
          <h2 id="movie-release-heading" className={"mb-2 " + heading}>
            {text.releases}
          </h2>
          <Suspense fallback={fallback}>
            <ReleaseDates locale={locale} region={region} id={id} text={text} />
          </Suspense>
        </section>
      )}
    </>
  );
}
