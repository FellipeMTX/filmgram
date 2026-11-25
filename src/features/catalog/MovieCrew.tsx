"use client";
import Link from "next/link";
import { Dialog } from "radix-ui";
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
    cast: "Cast",
    crew: "Crew",
    more: "See all",
    close: "Close",
    empty: "No credits available.",
    direction: "Direction and writing",
    production: "Production",
    technical: "Technical crew",
  },
  "pt-BR": {
    title: "Elenco e equipe",
    cast: "Elenco",
    crew: "Equipe técnica",
    more: "Ver mais",
    close: "Fechar",
    empty: "Nenhum crédito disponível.",
    direction: "Direção e roteiro",
    production: "Produção",
    technical: "Equipe técnica",
  },
  es: {
    title: "Reparto y equipo",
    cast: "Reparto",
    crew: "Equipo técnico",
    more: "Ver más",
    close: "Cerrar",
    empty: "No hay créditos disponibles.",
    direction: "Dirección y guion",
    production: "Producción",
    technical: "Equipo técnico",
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
  const role = (p: Person) =>
    p.character ||
    (p.job && locale !== "en"
      ? roles[p.job]?.[locale === "es" ? 1 : 0] || p.job
      : p.job);
  const group = (p: Person) =>
    p.department === "Directing" ||
    p.department === "Writing" ||
    ["Director", "Writer", "Screenplay", "Story"].includes(p.job || "")
      ? "direction"
      : p.department === "Production"
        ? "production"
        : "technical";
  function row(title: string, people: Person[], isCrew: boolean) {
    if (!people.length) return null;
    const featured = isCrew
      ? [
          ["Director"],
          ["Screenplay", "Writer", "Story"],
          ["Producer", "Executive Producer"],
          ["Director of Photography"],
          ["Editor"],
        ].flatMap((jobs) => {
          const person = people.find((candidate) =>
            jobs.includes(candidate.job || ""),
          );
          return person ? [person] : [];
        })
      : [];
    const preview = [...new Set([...featured, ...people])];
    const groups = isCrew
      ? (["direction", "production", "technical"] as const).map((key) => ({
          name: t[key],
          people: people.filter((p) => group(p) === key),
        }))
      : [{ name: title, people }];
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {people.length > 6 && (
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  {t.more}
                  <span className="sr-only">: {title}</span>
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="font-display text-xl font-bold">
                      {title}
                    </Dialog.Title>
                    <Dialog.Close className="text-sm font-semibold text-primary">
                      {t.close}
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">
                    {title}
                  </Dialog.Description>
                  {groups
                    .filter((g) => g.people.length > 0)
                    .map((g) => (
                      <section key={g.name} className="mt-4">
                        <h4 className="font-semibold">{g.name}</h4>
                        <ul className="divide-y divide-border">
                          {g.people.map((p, i) => (
                            <li key={`${p.id}-${p.job || p.character}-${i}`}>
                              <Link
                                className="block py-2 hover:text-primary"
                                href={`/${locale}/person/${p.id}`}
                              >
                                <strong>{p.name}</strong>
                                {role(p) && (
                                  <span className="block text-sm text-subtle">
                                    {role(p)}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
        <Rail
          variant="cast"
          label={title}
          previous={common.previous}
          next={common.next}
        >
          {preview.slice(0, 6).map((p, i) => (
            <PersonCard
              key={`${p.id}-${p.job || p.character}-${i}`}
              id={p.id}
              name={p.name}
              profilePath={p.profile_path}
              role={role(p)}
              locale={locale}
              movie
            />
          ))}
        </Rail>
      </section>
    );
  }
  return (
    <section className="space-y-5">
      <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight font-bold">
        {t.title}
      </h2>
      {row(t.cast, cast, false)}
      {row(t.crew, crew, true)}
      {!cast.length && !crew.length && <p className="text-subtle">{t.empty}</p>}
    </section>
  );
}
