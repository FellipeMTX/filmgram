import Link from "next/link";
import { imageUrl, titleName, year, type Title } from "@/integrations/tmdb";
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
        {image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          <span>{t.noPoster}</span>
        )}
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
  return (
    <section className={styles.shelf}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        <span>✦</span>
      </div>
      {items.length ? (
        <div className={styles.row}>
          {items.map((item) => (
            <Card
              key={`${item.media_type}-${item.id}`}
              item={item}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <p className="muted">{empty || messages(locale).noResults}</p>
      )}
    </section>
  );
}
