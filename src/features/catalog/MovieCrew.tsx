"use client";

import { useState } from "react";
import Link from "next/link";
import { NativeSelect } from "@/components/ui/native-select";
import { MediaImage } from "@/features/catalog/MediaImage";
import { imageUrl } from "@/integrations/tmdb-display";
import { Rail } from "@/features/catalog/Rail";
import { PersonCard } from "@/features/people/PersonCard";
import { messages } from "@/i18n/messages";

type Person = {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string;
  job?: string;
  department?: string;
};
const labels = {
  en: {
    title: "Cast and crew",
    filter: "Credits",
    cast: "Cast",
    direction: "Direction and writing",
    production: "Production",
    technical: "Technical crew",
    empty: "No credits available.",
  },
  "pt-BR": {
    title: "Elenco e equipe",
    filter: "Créditos",
    cast: "Elenco",
    direction: "Direção e roteiro",
    production: "Produção",
    technical: "Equipe técnica",
    empty: "Nenhum crédito disponível.",
  },
  es: {
    title: "Reparto y equipo",
    filter: "Créditos",
    cast: "Reparto",
    direction: "Dirección y guion",
    production: "Producción",
    technical: "Equipo técnico",
    empty: "No hay créditos disponibles.",
  },
};
export function MovieCrew({
  cast,
  crew,
  locale,
}: {
  cast: Person[];
  crew: Person[];
  locale: string;
}) {
  const [filter, setFilter] = useState<
    "cast" | "direction" | "production" | "technical"
  >("cast");
  const t = labels[locale as keyof typeof labels] || labels.en;
  const common = messages(locale);
  const roles: Record<string, [string, string]> = {
    Director: ["Direção", "Dirección"],
    Screenplay: ["Roteiro", "Guion"],
    Writer: ["Roteiro", "Guion"],
    Producer: ["Produção", "Producción"],
    Editor: ["Montagem", "Montaje"],
    "Original Music Composer": ["Trilha sonora", "Música original"],
    "Director of Photography": ["Fotografia", "Fotografía"],
  };
  const role = (person: Person) =>
    person.character ||
    (person.job && locale !== "en"
      ? roles[person.job]?.[locale === "es" ? 1 : 0] || person.job
      : person.job);
  const group = (p: Person) =>
    p.department === "Directing" ||
    p.department === "Writing" ||
    ["Director", "Writer", "Screenplay", "Story"].includes(p.job || "")
      ? "direction"
      : p.department === "Production"
        ? "production"
        : "technical";
  const rows =
    filter === "cast" ? cast : crew.filter((p) => group(p) === filter);
  const listRows = filter === "cast" ? rows.slice(6) : rows;
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">{t.title}</h2>
      <label className="flex flex-wrap items-center gap-3 text-sm font-bold">
        {t.filter}
        <NativeSelect
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          {(["cast", "direction", "production", "technical"] as const).map(
            (key) => (
              <option key={key} value={key}>
                {t[key]}
              </option>
            ),
          )}
        </NativeSelect>
      </label>
      {filter === "cast" && cast.length > 0 && (
        <section aria-label={common.cast}>
          <h3 className="sr-only">{common.cast}</h3>
          <Rail
            variant="cast"
            label={common.cast}
            previous={common.previous}
            next={common.next}
          >
            {cast.slice(0, 6).map((p) => (
              <PersonCard
                key={p.id}
                id={p.id}
                name={p.name}
                profilePath={p.profile_path}
                role={p.character}
                locale={locale}
              />
            ))}
          </Rail>
        </section>
      )}
      {listRows.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {listRows.map((p, i) => (
            <li key={`${p.id}-${p.job || p.character}-${i}`} className="p-3">
              <Link
                href={`/${locale}/person/${p.id}`}
                className="flex items-center gap-3 hover:text-primary"
              >
                <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-title-placeholder text-title-muted [&_img]:size-full [&_img]:object-cover">
                  <MediaImage
                    src={imageUrl(p.profile_path, "w185")}
                    alt=""
                    fallback={p.name.slice(0, 1)}
                  />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <span className="block text-sm text-subtle">{role(p)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : !rows.length ? (
        <p className="text-subtle">{t.empty}</p>
      ) : null}
    </section>
  );
}
