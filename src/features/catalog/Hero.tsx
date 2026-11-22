"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { imageUrl, titleName, year } from "@/integrations/tmdb-display";
import type { Title } from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import styles from "@/app/[locale]/discover/page.module.css";
export function Hero({
  items,
  locale,
  trendingKeys,
}: {
  items: Title[];
  locale: string;
  trendingKeys: string[];
}) {
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  const t = messages(locale),
    item = items[index];
  if (!item) return <p className="container muted">{t.noResults}</p>;
  const move = (n: number) =>
    setIndex((i) => (i + n + items.length) % items.length);
  return (
    <section
      className={styles.hero}
      aria-label={t.featured}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
      onTouchStart={(e) => {
        start.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (start.current !== null) {
          const d =
            (e.changedTouches[0]?.clientX ?? start.current) - start.current;
          if (Math.abs(d) > 50) move(d < 0 ? 1 : -1);
          start.current = null;
        }
      }}
    >
      <Link
        className={styles.heroLink}
        href={`/${locale}/title/${item.media_type}/${item.id}`}
        style={{
          backgroundImage: `linear-gradient(90deg,#100e0d 2%,#100e0dbb 38%,#100e0d18 80%),linear-gradient(0deg,#100e0d 0%,transparent 42%),url(${imageUrl(item.backdrop_path, "original") || ""})`,
        }}
      >
        <div className={`${styles.heroInner} container`}>
          <p className="eyebrow">
            ✦ &nbsp;{" "}
            {trendingKeys.includes(`${item.media_type}-${item.id}`)
              ? t.trendingToday
              : t.topRated}
          </p>
          <h1>{titleName(item)}</h1>
          <p className={styles.heroMeta}>
            {item.media_type === "movie" ? t.film : t.seriesOne} <i>·</i>{" "}
            {year(item) || "—"} <i>·</i> <span>★</span>{" "}
            {item.vote_average?.toFixed(1) || "—"} TMDB
          </p>
          <p className={styles.overview}>{item.overview}</p>
          <span className="button primary">{t.viewDetails} ↗</span>
        </div>
      </Link>
      <div className={`${styles.heroControls} container`}>
        <button type="button" aria-label={t.previous} onClick={() => move(-1)}>
          ‹
        </button>
        {items.map((x, i) => (
          <button
            type="button"
            key={`${x.media_type}-${x.id}`}
            className={i === index ? styles.activeDot : styles.dot}
            aria-label={`${t.highlight} ${i + 1} ${t.of} ${items.length}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
        <button type="button" aria-label={t.next} onClick={() => move(1)}>
          ›
        </button>
      </div>
    </section>
  );
}
