import Link from "next/link";
import { imageUrl, titleName, year } from "@/integrations/tmdb-display";
import type { Title } from "@/integrations/tmdb";
import { Rail } from "./Rail";
import { MediaImage } from "./MediaImage";
import { messages } from "@/i18n/messages";
import styles from "./Cards.module.css";
export function Card({ item, locale }: { item: Title; locale: string }) {
  const t = messages(locale),
    image = imageUrl(item.poster_path);
  return (
    <Link
      className={styles.card}
      href={`/${locale}/title/${item.media_type}/${item.id}`}
    >
      <div className={styles.poster}>
        <MediaImage src={image} alt="" fallback={t.noPoster} />
        <span className={styles.cardBadge}>
          {item.media_type === "movie" ? t.film : t.seriesOne}
        </span>
      </div>
      <div className={styles.cardTitle}>{titleName(item)}</div>
      <div className={styles.meta}>
        <span>{year(item) || "—"}</span>
        <span className={styles.rating}>
          ★ <b>{item.vote_average?.toFixed(1) || "—"}</b>
        </span>
      </div>
    </Link>
  );
}
export function Shelf({
  title,
  items,
  locale,
  empty,
}: {
  title: string;
  items: Title[];
  locale: string;
  empty?: string;
}) {
  const headingId = `shelf-${title.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <section className={styles.shelf} aria-labelledby={headingId}>
      <div className={styles.sectionHeading}>
        <h2 id={headingId}>{title}</h2>
        <span>✦</span>
      </div>
      {items.length ? (
        <Rail
          label={title}
          previous={messages(locale).previous}
          next={messages(locale).next}
        >
          {items.map((item) => (
            <Card
              key={`${item.media_type}-${item.id}`}
              item={item}
              locale={locale}
            />
          ))}
        </Rail>
      ) : (
        <p className="muted">{empty || messages(locale).noResults}</p>
      )}
    </section>
  );
}
