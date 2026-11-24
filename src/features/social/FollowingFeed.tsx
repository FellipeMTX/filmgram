"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ReviewPost } from "@/components/ReviewPost";
import { imageUrl } from "@/integrations/tmdb-display";
import { messages } from "@/i18n/messages";
import { loadFollowing } from "./feed-actions";
import type { FeedPage } from "./feed";
import { SocialEmpty } from "./SocialEmpty";
import { ReviewDiscussion } from "./ReviewDiscussion";

const labels = {
  en: {
    more: "Load more reviews",
    loading: "Loading…",
    failed: "Could not load more reviews. Please try again.",
    unknown: "Title unavailable",
    loaded: (n: number) => `${n} reviews shown`,
  },
  "pt-BR": {
    more: "Carregar mais resenhas",
    loading: "Carregando…",
    failed: "Não foi possível carregar mais resenhas. Tente novamente.",
    unknown: "Título indisponível",
    loaded: (n: number) => `${n} resenhas exibidas`,
  },
  es: {
    more: "Cargar más reseñas",
    loading: "Cargando…",
    failed: "No se pudieron cargar más reseñas. Inténtalo de nuevo.",
    unknown: "Título no disponible",
    loaded: (n: number) => `${n} reseñas visibles`,
  },
};
export function FollowingFeed({
  initial,
  locale,
  userId,
}: {
  initial: FeedPage;
  locale: string;
  userId: string;
}) {
  const [source, setSource] = useState(initial),
    [items, setItems] = useState(initial.items),
    [next, setNext] = useState(initial.next);
  const [failed, setFailed] = useState(false),
    [pending, startTransition] = useTransition();
  const focusPost = useRef<string | null>(null),
    feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusPost.current) return;
    const post = feed.current?.querySelector<HTMLElement>(
      `[data-review-id="${CSS.escape(focusPost.current)}"]`,
    );
    if (post) {
      post.focus();
      focusPost.current = null;
    }
  }, [items]);
  if (source !== initial) {
    setSource(initial);
    setItems(initial.items);
    setNext(initial.next);
    setFailed(false);
  }
  const t = messages(locale),
    l = labels[locale as keyof typeof labels] || labels.en;
  if (!items.length)
    return (
      <SocialEmpty
        message={t.followingEmpty}
        action={{ href: `/${locale}/discover`, label: t.discover }}
      />
    );
  return (
    <div className="space-y-4" ref={feed}>
      {items.map((r) => (
        <div key={r.id}>
          <ReviewPost
            reviewId={r.id}
            tmdbId={r.tmdb_id}
            locale={locale}
            mediaType={r.media_type === "movie" ? "movie" : "tv"}
            author={{
              name: r.display_name,
              href: `/${locale}/profile/${r.handle}`,
              avatarUrl: r.avatar_url,
            }}
            date={new Date(r.created_at).toLocaleDateString(locale)}
            title={r.title || l.unknown}
            year={r.year || undefined}
            rating={r.rating}
            text={r.body || ""}
            content={r.body_document}
            titleHref={`/${locale}/title/${r.media_type}/${r.tmdb_id}`}
            backdropUrl={imageUrl(r.backdrop, "w780")}
            posterUrl={imageUrl(r.poster, "w185")}
            trailerUrl={
              r.youtube_video_id
                ? `https://www.youtube.com/watch?v=${r.youtube_video_id}`
                : null
            }
            interaction={
              <ReviewDiscussion
                reviewId={r.id}
                locale={locale}
                userId={userId}
                initialCount={r.likeCount}
                initialCommentCount={r.commentCount}
                initialLiked={r.liked}
              />
            }
          />
        </div>
      ))}
      <p role="status" className="sr-only">
        {pending
          ? l.loading
          : items.length > initial.items.length
            ? l.loaded(items.length)
            : ""}
      </p>
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
            onClick={(event) => {
              const byKeyboard = event.detail === 0;
              setFailed(false);
              startTransition(async () => {
                try {
                  const page = await loadFollowing(locale, next);
                  if (byKeyboard || !page.next)
                    focusPost.current = page.items[0]?.id ?? null;
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
