"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { MediaImage } from "@/features/catalog/MediaImage";
import { imageUrl } from "@/integrations/tmdb-display";
import { messages } from "@/i18n/messages";
import { loadFollowing } from "./feed-actions";
import type { FeedPage } from "./feed";

const labels = {
  en: {
    more: "Load more",
    loading: "Loading…",
    failed: "Could not load more reviews. Please try again.",
    movie: "Film",
    tv: "Series",
    unknown: "Title unavailable",
    rating: "Rating",
  },
  "pt-BR": {
    more: "Ver mais",
    loading: "Carregando…",
    failed: "Não foi possível carregar mais avaliações. Tente novamente.",
    movie: "Filme",
    tv: "Série",
    unknown: "Título indisponível",
    rating: "Avaliação",
  },
  es: {
    more: "Ver más",
    loading: "Cargando…",
    failed: "No se pudieron cargar más reseñas. Inténtalo de nuevo.",
    movie: "Película",
    tv: "Serie",
    unknown: "Título no disponible",
    rating: "Valoración",
  },
};
export function FollowingFeed({
  initial,
  locale,
}: {
  initial: FeedPage;
  locale: string;
}) {
  const [source, setSource] = useState(initial);
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (source !== initial) {
    setSource(initial);
    setItems(initial.items);
    setNext(initial.next);
    setFailed(false);
  }
  const t = messages(locale),
    l = labels[locale as keyof typeof labels] || labels.en;
  if (!items.length)
    return <p className="text-muted-foreground">{t.followingEmpty}</p>;
  return (
    <div className="space-y-4">
      {items.map((r) => (
        <article
          key={r.id}
          className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/profile/${r.handle}`}
              aria-label={r.display_name}
            >
              <Avatar size="lg">
                <AvatarImage src={r.avatar_url || undefined} alt="" />
                <AvatarFallback>
                  {r.display_name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0">
              <Link
                className="break-words font-bold hover:text-primary"
                href={`/${locale}/profile/${r.handle}`}
              >
                {r.display_name}
              </Link>
              <p className="break-words text-sm text-muted-foreground">
                @{r.handle} ·{" "}
                <time dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleDateString(locale)}
                </time>
              </p>
            </div>
          </div>
          {r.body && (
            <p className="mt-5 whitespace-pre-wrap break-words leading-relaxed">
              {r.body}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 text-xl text-primary">
            <span aria-hidden="true">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="sr-only">{l.rating}: </span>
              {r.rating}/5
            </span>
          </div>
          <Link
            className="mt-4 flex overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary"
            href={`/${locale}/title/${r.media_type}/${r.tmdb_id}`}
          >
            <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden bg-muted text-center text-xs text-muted-foreground [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              <MediaImage
                src={imageUrl(r.poster, "w185")}
                alt=""
                fallback={t.noPoster}
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-1 px-4">
              <strong className="break-words">{r.title || l.unknown}</strong>
              <span className="text-sm text-muted-foreground">
                {r.media_type === "movie" ? l.movie : l.tv}
                {r.year ? ` · ${r.year}` : ""}
              </span>
            </div>
          </Link>
          {r.youtube_video_id && (
            <a
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}
              href={`https://www.youtube.com/watch?v=${r.youtube_video_id}`}
              target="_blank"
              rel="noreferrer"
            >
              ▶ YouTube
            </a>
          )}
        </article>
      ))}
      {failed && (
        <p role="alert" className="text-muted-foreground">
          {l.failed}
        </p>
      )}
      {next && (
        <div className="text-center">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setFailed(false);
              startTransition(async () => {
                try {
                  const page = await loadFollowing(locale, next);
                  setItems((previous) => [
                    ...previous,
                    ...page.items.filter(
                      (item) => !previous.some((p) => p.id === item.id),
                    ),
                  ]);
                  setNext(page.next);
                } catch {
                  setFailed(true);
                }
              });
            }}
          >
            {pending ? l.loading : l.more}
          </Button>
        </div>
      )}
    </div>
  );
}
