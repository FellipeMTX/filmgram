import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/features/catalog/Cards";
import { MediaImage } from "@/features/catalog/MediaImage";
import {
  filterAndPaginateWorks,
  validCreditDate,
} from "@/features/people/filmography";
import { messages } from "@/i18n/messages";
import { getPersonDetails, imageUrl } from "@/integrations/tmdb";
import { container, eyebrow } from "@/lib/layout";
import { cn } from "@/lib/utils";

function dateLabel(value: string | null | undefined, locale: string) {
  const valid = validCreditDate(value);
  return valid
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${valid}T00:00:00Z`))
    : "";
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    type?: string | string[];
    activity?: string | string[];
    page?: string | string[];
  }>;
}) {
  const { locale, id } = await params;
  const numericId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId <= 0)
    notFound();
  const person = await getPersonDetails(locale, numericId);
  if (!person) notFound();
  const t = messages(locale);
  const result = filterAndPaginateWorks(person.works, await searchParams);
  const { type, activity, page, totalPages } = result;
  const href = (nextType: string, nextActivity: string, nextPage = 1) => {
    const query = new URLSearchParams({
      type: nextType,
      activity: nextActivity,
    });
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/${locale}/person/${person.id}?${query}`;
  };
  const roleNames: Record<string, string> = {
    Director: t.roleDirector,
    Producer: t.roleProducer,
    "Executive Producer": t.roleExecutiveProducer,
    Writer: t.roleWriter,
    Screenplay: t.roleScreenplay,
    Story: t.roleStory,
    Acting: t.acting,
    Directing: t.directing,
  };
  const activities = [
    person.works.some((work) => work.directing) ? t.directing : "",
    person.works.some((work) => work.acting) ? t.acting : "",
  ].filter(Boolean);
  const profession = activities.length
    ? activities.join(" · ")
    : person.known_for_department
      ? roleNames[person.known_for_department] || person.known_for_department
      : "";
  const birth = dateLabel(person.birthday, locale),
    death = dateLabel(person.deathday, locale);
  const aliases =
    person.also_known_as?.filter(
      (name) => name.trim() && name.trim() !== person.name,
    ) || [];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main>
      <section className="relative flex min-h-[380px] items-end bg-[radial-gradient(ellipse_at_73%_20%,#69443a_0%,#34231f_28%,#171211_58%,#100e0d_86%)] mobile:min-h-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#100e0df2_0%,#100e0d8c_55%,#100e0d33),linear-gradient(0deg,#100e0d,transparent_56%)]"
        />
        <div
          className={cn(
            container,
            "relative grid grid-cols-[220px_minmax(0,650px)] items-start gap-x-[34px] gap-y-4 pt-[52px] pb-[35px] mobile:grid-cols-[105px_minmax(0,1fr)] mobile:gap-x-[18px] mobile:pt-8 mobile:pb-7",
          )}
        >
          <div className="relative row-span-2 grid aspect-[2/3] w-[220px] mobile:row-span-1 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-title-placeholder text-center text-title-muted shadow-[0_12px_28px_#0005] mobile:w-[105px] [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
            <MediaImage
              src={imageUrl(person.profile_path, "w500")}
              alt={person.name}
              fallback={t.personNoPhoto}
            />
          </div>
          <div className="min-w-0 max-w-[650px] [overflow-wrap:anywhere]">
            {profession && <p className={eyebrow}>{profession}</p>}
            <h1 className="mt-[13px] mb-4 break-words font-display text-[clamp(42px,6vw,74px)] leading-none font-bold tracking-[-0.035em] mobile:my-[10px] mobile:text-[37px]">
              {person.name}
            </h1>
            <div className="space-y-1 text-[13px] leading-[1.8] text-detail-meta mobile:text-[11px] mobile:leading-[1.6]">
              {birth && (
                <p>
                  <strong className="text-foreground">{t.personBorn}</strong>{" "}
                  &nbsp; {birth}
                </p>
              )}
              {death && (
                <p>
                  <strong className="text-foreground">{t.personDied}</strong>{" "}
                  &nbsp; {death}
                </p>
              )}
              {person.place_of_birth && (
                <p>
                  <strong className="text-foreground">
                    {t.personBirthplace}
                  </strong>{" "}
                  &nbsp; {person.place_of_birth}
                </p>
              )}
              {aliases.length > 0 && (
                <p>
                  <strong className="text-foreground">
                    {t.personAlsoKnownAs}
                  </strong>{" "}
                  &nbsp; {aliases.join(", ")}
                </p>
              )}
            </div>
          </div>
          <p className="col-start-2 m-0 max-w-[590px] whitespace-pre-line text-sm leading-[1.7] text-detail-meta [overflow-wrap:anywhere] mobile:col-span-2 mobile:col-start-1 mobile:text-xs mobile:leading-[1.5]">
            {person.biography?.trim() || t.noBiography}
          </p>
        </div>
      </section>
      <section
        className={cn(
          container,
          "pt-[30px] pb-[60px] mobile:pt-[25px] mobile:pb-[65px]",
        )}
        aria-labelledby="filmography-heading"
      >
        <div className="mb-5">
          <h2
            id="filmography-heading"
            className="m-0 font-display text-[27px] font-semibold tracking-[-0.015em]"
          >
            {t.filmography}
          </h2>
          <p className="mt-[5px] text-xs text-muted-foreground">
            {t.personWorks} · {result.total}
          </p>
        </div>
        <div className="mb-6 flex flex-wrap justify-between gap-2.5 border-b border-border pb-[15px] mobile:block">
          <nav aria-label={t.mediaType} className="flex flex-wrap gap-[7px]">
            {(
              [
                ["all", t.all],
                ["movie", t.films],
                ["tv", t.series],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={href(value, activity)}
                aria-current={type === value ? "page" : undefined}
                className={buttonVariants({
                  variant: type === value ? "default" : "outline",
                  size: "sm",
                  className: "text-xs",
                })}
              >
                {label}
              </Link>
            ))}
          </nav>
          <nav
            aria-label={t.personRole}
            className="flex flex-wrap gap-[7px] mobile:mt-2.5"
          >
            {(
              [
                ["all", t.allActivities],
                ["acting", t.acting],
                ["directing", t.directing],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={href(type, value)}
                aria-current={activity === value ? "page" : undefined}
                className={buttonVariants({
                  variant: activity === value ? "default" : "outline",
                  size: "sm",
                  className: "text-xs",
                })}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {result.works.length ? (
          <div className="grid grid-cols-6 gap-[18px] mobile:grid-cols-2 mobile:gap-x-[14px] mobile:gap-y-5">
            {result.works.map((work) => {
              const released = validCreditDate(
                work.media_type === "movie"
                  ? work.release_date
                  : work.first_air_date,
              );
              const roles = [
                ...work.jobs.map((job) => roleNames[job] || job),
                ...(work.characters.length
                  ? work.characters
                  : work.acting
                    ? [t.acting]
                    : []),
              ];
              return (
                <article
                  key={`${work.media_type}-${work.id}`}
                  className="relative min-w-0"
                >
                  <Card item={work} locale={locale} />
                  {released && released > today && (
                    <span className="mt-1 inline-block text-[11px] font-bold text-primary">
                      {t.upcoming}
                    </span>
                  )}
                  {roles.length > 0 && (
                    <p className="mt-1.5 text-[11px] leading-[1.4] text-detail-meta [overflow-wrap:anywhere]">
                      {roles.join(" · ")}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            {t.noPersonWorks}
          </p>
        )}
        {totalPages > 1 && (
          <nav
            aria-label={t.filmography}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm"
          >
            {page > 1 ? (
              <Link
                href={href(type, activity, page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t.previousPage}
              </Link>
            ) : (
              <span aria-disabled="true" className="text-muted-foreground">
                {t.previousPage}
              </span>
            )}
            <span>
              {t.page} {page} {t.of} {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={href(type, activity, page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t.nextPage}
              </Link>
            ) : (
              <span aria-disabled="true" className="text-muted-foreground">
                {t.nextPage}
              </span>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
