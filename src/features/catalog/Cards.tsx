import Link from "next/link";
import { imageUrl, titleName, year } from "@/integrations/tmdb-display";
import type { Title } from "@/integrations/tmdb";
import { Rail } from "./Rail";
import { MediaImage } from "./MediaImage";
import { messages } from "@/i18n/messages";

export function Card({ item, locale }: { item: Title; locale: string }) {
  const t = messages(locale),
    image = imageUrl(item.poster_path);
  return (
    <Link
      className={"block min-w-0 motion-safe:[&:hover_img]:scale-[1.04]"}
      href={`/${locale}/title/${item.media_type}/${item.id}`}
    >
      <div
        className={
          "relative grid aspect-[2/3] place-items-center overflow-hidden rounded-[5px] bg-secondary text-center text-[13px] text-poster-placeholder [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-300 motion-reduce:[&_img]:transition-none"
        }
      >
        <MediaImage src={image} alt="" fallback={t.noPoster} />
        <span
          className={
            "absolute top-2.5 left-2.5 rounded-full border border-badge-border bg-badge-background px-2.5 py-[5px] text-[10px] font-bold tracking-[0.06em] text-button-foreground uppercase shadow-[0_2px_10px_#0005]"
          }
        >
          {item.media_type === "movie" ? t.film : t.seriesOne}
        </span>
      </div>
      <div
        className={
          "mt-[11px] truncate text-[15px] font-bold mobile:text-[13px]"
        }
      >
        {titleName(item)}
      </div>
      <div
        className={
          "mt-[5px] flex justify-between text-xs text-muted-foreground"
        }
      >
        <span>{year(item) || "—"}</span>
        <span
          className={"text-primary [&_b]:ml-[3px] [&_b]:text-rating-foreground"}
        >
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
    <section className={"my-11 mobile:my-[29px]"} aria-labelledby={headingId}>
      <div
        className={
          "mb-[18px] flex items-center gap-[15px] mobile:mb-[14px] [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-[25px] [&_h2]:tracking-[-0.5px] mobile:[&_h2]:text-[22px] [&_span]:text-[13px] [&_span]:text-primary"
        }
      >
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
        <p className="text-muted-foreground">
          {empty || messages(locale).noResults}
        </p>
      )}
    </section>
  );
}
