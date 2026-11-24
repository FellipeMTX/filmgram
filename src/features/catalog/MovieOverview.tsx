import Link from "next/link";
import type { Title } from "@/integrations/tmdb";
import { imageUrl } from "@/integrations/tmdb-display";
import { MediaImage } from "@/features/catalog/MediaImage";

const labels = {
  en: {
    facts: "Film details",
    cast: "Key crew",
    more: "View cast and crew",
    year: "Original title",
    runtime: "Status",
    genres: "Production companies",
    countries: "Production countries",
    language: "Spoken languages",
    companies: "Budget",
    revenue: "Box office revenue",
    missing: "Not available",
    empty: "No crew available.",
  },
  "pt-BR": {
    facts: "Ficha técnica",
    cast: "Equipe principal",
    more: "Ver elenco e equipe",
    year: "Título original",
    runtime: "Situação",
    genres: "Produtoras",
    countries: "País de produção",
    language: "Idiomas falados",
    companies: "Orçamento",
    revenue: "Receita de bilheteria",
    missing: "Não informado",
    empty: "Nenhum integrante da equipe disponível.",
  },
  es: {
    facts: "Ficha técnica",
    cast: "Equipo principal",
    more: "Ver reparto y equipo",
    year: "Título original",
    runtime: "Estado",
    genres: "Productoras",
    countries: "País de producción",
    language: "Idiomas hablados",
    companies: "Presupuesto",
    revenue: "Recaudación",
    missing: "No disponible",
    empty: "No hay equipo disponible.",
  },
};
export function MovieOverview({
  item,
  locale,
  titleHref,
}: {
  item: Title;
  locale: string;
  titleHref: string;
}) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const extra = item;
  const money = (value?: number) =>
    value && value > 0
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value)
      : "";
  const jobs: Record<string, [string, string, string]> = {
    Director: ["Director", "Direção", "Dirección"],
    Screenplay: ["Screenplay", "Roteiro", "Guion"],
    Writer: ["Writer", "Roteiro", "Guion"],
    Producer: ["Producer", "Produção", "Producción"],
    "Director of Photography": ["Cinematography", "Fotografia", "Fotografía"],
  };
  const jobName = (job: string) =>
    jobs[job]?.[locale === "pt-BR" ? 1 : locale === "es" ? 2 : 0] || job;
  const statuses: Record<string, [string, string]> = {
    Released: ["Lançado", "Estrenada"],
    "In Production": ["Em produção", "En producción"],
    "Post Production": ["Pós-produção", "Posproducción"],
    Planned: ["Planejado", "Planeada"],
    Canceled: ["Cancelado", "Cancelada"],
  };
  const primary = [
    "Director",
    "Screenplay",
    "Writer",
    "Producer",
    "Director of Photography",
  ]
    .flatMap((job) => (item.credits?.crew || []).filter((p) => p.job === job))
    .filter((p, i, all) => all.findIndex((other) => other.id === p.id) === i)
    .slice(0, 4);
  const facts = [
    [t.year, extra.original_title],
    [
      t.runtime,
      extra.status && locale !== "en"
        ? statuses[extra.status]?.[locale === "es" ? 1 : 0] || extra.status
        : extra.status,
    ],
    [t.genres, extra.production_companies?.map((c) => c.name).join(" · ")],
    [t.countries, extra.production_countries?.map((c) => c.name).join(", ")],
    [
      t.language,
      extra.spoken_languages
        ?.map((l) => l.name || l.english_name)
        .filter(Boolean)
        .join(", "),
    ],
    [t.companies, money(extra.budget)],
    [t.revenue, money(extra.revenue)],
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-5 mobile:grid-cols-1">
      <section className="rounded-xl border border-border bg-card p-[clamp(13px,2.4vw,23px)]">
        <h2 className="mb-5 font-display text-2xl font-bold">{t.facts}</h2>
        <dl className="grid grid-cols-2 gap-4">
          {facts.map(([name, value]) => (
            <div key={name}>
              <dt className="text-xs font-bold text-subtle">{name}</dt>
              <dd className="mt-1 text-sm">{value || t.missing}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-xl border border-border bg-card p-[clamp(13px,2.4vw,23px)]">
        <h2 className="mb-4 font-display text-2xl font-bold">{t.cast}</h2>
        {primary.length ? (
          <div className="grid grid-cols-2 gap-3">
            {primary.map((person) => (
              <Link
                key={person.id}
                href={`/${locale}/person/${person.id}`}
                className="flex min-w-0 items-center gap-2 hover:text-primary"
              >
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-title-placeholder text-title-muted [&_img]:size-full [&_img]:object-cover">
                  <MediaImage
                    src={imageUrl(person.profile_path, "w185")}
                    alt=""
                    fallback={person.name.slice(0, 1)}
                  />
                </span>
                <span className="min-w-0 text-sm">
                  <strong className="block">{person.name}</strong>
                  <span className="text-xs text-subtle">
                    {jobName(person.job)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-subtle">{t.empty}</p>
        )}
        <Link
          scroll={false}
          href={`${titleHref}?tab=crew`}
          className="mt-4 inline-block text-sm font-bold text-primary hover:underline"
        >
          {t.more} →
        </Link>
      </section>
    </div>
  );
}
