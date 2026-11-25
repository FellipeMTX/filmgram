import type { Title } from "@/integrations/tmdb";

const labels = {
  en: {
    facts: "Film details",
    originalTitle: "Original title",
    status: "Status",
    companies: "Production companies",
    countries: "Production countries",
    languages: "Spoken languages",
    budget: "Budget",
    revenue: "Box office revenue",
    missing: "Not available",
  },
  "pt-BR": {
    facts: "Ficha técnica",
    originalTitle: "Título original",
    status: "Situação",
    companies: "Produtoras",
    countries: "País de produção",
    languages: "Idiomas falados",
    budget: "Orçamento",
    revenue: "Receita de bilheteria",
    missing: "Não informado",
  },
  es: {
    facts: "Ficha técnica",
    originalTitle: "Título original",
    status: "Estado",
    companies: "Productoras",
    countries: "País de producción",
    languages: "Idiomas hablados",
    budget: "Presupuesto",
    revenue: "Recaudación",
    missing: "No disponible",
  },
};

const statuses: Record<string, [string, string]> = {
  Released: ["Lançado", "Estrenada"],
  "In Production": ["Em produção", "En producción"],
  "Post Production": ["Pós-produção", "Posproducción"],
  Planned: ["Planejado", "Planeada"],
  Canceled: ["Cancelado", "Cancelada"],
  Rumored: ["Rumor", "Rumor"],
};

export function MovieOverview({
  item,
  locale,
}: {
  item: Title;
  locale: string;
}) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const languageIndex = locale === "pt-BR" ? 0 : locale === "es" ? 1 : null;
  const facts = [
    [t.originalTitle, item.original_title],
    [
      t.status,
      item.status && languageIndex !== null
        ? statuses[item.status]?.[languageIndex] || item.status
        : item.status,
    ],
    [t.companies, item.production_companies?.map((c) => c.name).join(" · ")],
    [t.countries, item.production_countries?.map((c) => c.name).join(", ")],
    [
      t.languages,
      item.spoken_languages
        ?.map((l) => l.name || l.english_name)
        .filter(Boolean)
        .join(", "),
    ],
    [
      t.budget,
      item.budget && item.budget > 0 ? currency.format(item.budget) : null,
    ],
    [
      t.revenue,
      item.revenue && item.revenue > 0 ? currency.format(item.revenue) : null,
    ],
  ];

  return (
    <section aria-labelledby="movie-facts-heading">
      <h2
        id="movie-facts-heading"
        className="mb-3 font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight font-bold"
      >
        {t.facts}
      </h2>
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 text-sm">
        {facts.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-subtle">{name}</dt>
            <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">
              {value || t.missing}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
