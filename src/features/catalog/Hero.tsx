"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { imageUrl, titleName, year } from "@/integrations/tmdb-display";
import type { Title } from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import { container, eyebrow } from "@/lib/layout";

const DURATION = 6000;
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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reset, setReset] = useState(0);
  const start = useRef<number | null>(null);
  const elapsed = useRef(0);
  const progress = useRef<HTMLSpanElement>(null);
  const t = messages(locale),
    item = items[index];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (progress.current)
      progress.current.style.transform = `scaleX(${elapsed.current / DURATION})`;
    if (hovered || focused || hidden || reducedMotion || items.length < 2)
      return;
    let previous = performance.now();
    let frame: number;
    const tick = (now: number) => {
      elapsed.current += now - previous;
      previous = now;
      if (elapsed.current >= DURATION) {
        elapsed.current = 0;
        setIndex((current) => (current + 1) % items.length);
        return;
      }
      if (progress.current)
        progress.current.style.transform = `scaleX(${elapsed.current / DURATION})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [focused, hidden, hovered, index, items.length, reducedMotion, reset]);

  const select = (i: number) => {
    elapsed.current = 0;
    setIndex(i);
    setReset((value) => value + 1);
  };
  const move = (n: number) => select((index + n + items.length) % items.length);
  if (!item)
    return (
      <p className={`${container} text-muted-foreground`}>{t.noResults}</p>
    );
  return (
    <section
      className="relative grid touch-pan-y overflow-hidden mobile:mx-4 mobile:rounded-[13px]"
      aria-label={t.featured}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(e.key === "ArrowRight" ? 1 : -1);
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
        className="group relative focus-visible:outline-offset-[-3px] col-start-1 row-start-1 flex min-h-[480px] items-center overflow-hidden pt-8 pb-[78px] mobile:min-h-[410px] mobile:items-end mobile:pt-6 mobile:pb-[75px]"
        href={`/${locale}/title/${item.media_type}/${item.id}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-[center_40%] transition-transform duration-300 motion-safe:group-hover:scale-[1.04] motion-safe:group-focus-visible:scale-[1.04] motion-reduce:transition-none mobile:bg-[60%_center]"
          style={{
            backgroundImage: `url(${imageUrl(item.backdrop_path, "original") || ""})`,
          }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,#100e0d_2%,#100e0dbb_38%,#100e0d18_80%),linear-gradient(0deg,#100e0d_0%,transparent_42%)]"
        />
        <div
          className={`${container} relative min-w-0 mobile:mx-0 mobile:w-full mobile:px-4`}
        >
          <p className={eyebrow}>
            ✦ &nbsp;{" "}
            {trendingKeys.includes(`${item.media_type}-${item.id}`)
              ? t.trendingToday
              : t.topRated}
          </p>
          <h1 className="my-[18px] max-w-[700px] break-words font-display text-[clamp(52px,6vw,92px)] leading-[0.95] tracking-[-3px] text-heading [overflow-wrap:anywhere] mobile:my-2.5 mobile:text-[clamp(32px,10vw,52px)] mobile:tracking-[-2px]">
            {titleName(item)}
          </h1>
          <p className="text-sm text-hero-meta mobile:text-[13px]">
            {item.media_type === "movie" ? t.film : t.seriesOne}{" "}
            <i className="mx-2 text-hero-separator not-italic">·</i>{" "}
            {year(item) || "—"}{" "}
            <i className="mx-2 text-hero-separator not-italic">·</i>{" "}
            <span className="text-primary">★</span>{" "}
            {item.vote_average?.toFixed(1) || "—"} TMDB
          </p>
          <p className="mt-[22px] mb-7 w-full text-justify text-sm leading-[1.65] text-hero-description mobile:hidden">
            {item.overview}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px] z-[2] rounded-[inherit] border-2 border-transparent group-focus-visible:border-ring"
        />
      </Link>
      {items.length > 1 && (
        <div className="relative z-[1] col-start-1 row-start-1 mb-[15px] flex items-center self-end justify-self-center">
          <div className="flex items-center gap-0.5 rounded-full border border-controls-border bg-controls-background p-1">
            {items.map((x, i) => (
              <button
                type="button"
                key={`${x.media_type}-${x.id}`}
                className="grid h-7 min-w-7 place-items-center rounded-full bg-transparent hover:bg-accent"
                aria-label={`${t.highlight} ${i + 1} ${t.of} ${items.length}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => select(i)}
              >
                {i === index ? (
                  <span
                    className={`relative h-[7px] w-[22px] overflow-hidden rounded-full ${reducedMotion ? "bg-primary" : "bg-primary/30"}`}
                  >
                    <span
                      ref={progress}
                      className="absolute inset-0 origin-left [transform:scaleX(0)] bg-primary"
                    />
                  </span>
                ) : (
                  <span className="h-[7px] w-[7px] rounded-full bg-dot" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
