import { Card } from "@/features/catalog/Cards";
import { Rail } from "@/features/catalog/Rail";
import {
  validCreditDate,
  type PersonWork,
} from "@/features/people/filmography";
import { messages } from "@/i18n/messages";
export function RecentWorks({
  works,
  locale,
  today,
}: {
  works: PersonWork[];
  locale: string;
  today: string;
}) {
  const t = messages(locale);
  const recent = works
    .filter((work) => {
      const date = validCreditDate(
        work.media_type === "movie" ? work.release_date : work.first_air_date,
      );
      return date && date <= today;
    })
    .slice(0, 6);
  if (!recent.length) return null;
  return (
    <section aria-labelledby="recent-works-heading" className="mb-11">
      <h2
        id="recent-works-heading"
        className="m-0 font-display text-[27px] font-semibold"
      >
        {t.recentWorks}
      </h2>
      <p className="mt-[5px] mb-5 text-xs text-muted-foreground">
        {t.recentWorksCaption}
      </p>
      <Rail label={t.recentWorks} previous={t.previous} next={t.next}>
        {recent.map((work) => (
          <Card
            key={`${work.media_type}-${work.id}`}
            item={work}
            locale={locale}
          />
        ))}
      </Rail>
    </section>
  );
}
