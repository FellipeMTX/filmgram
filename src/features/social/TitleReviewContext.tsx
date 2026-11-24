"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import {
  CommunityEditor,
  CommunityEditorContext,
  CommunityEditControl,
  CommunityCardEditor,
} from "./CommunityEditor";
import { loadTitleReviewContext } from "./title-review-context";
import { ReviewDiscussion } from "./ReviewDiscussion";
import { FollowReviewAuthor } from "./FollowReviewAuthor";
import { ReviewVideo } from "@/components/ReviewVideo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReviewCard } from "@/components/ReviewCard";

type Context = Awaited<ReturnType<typeof loadTitleReviewContext>>;
const labels = {
  en: {
    loading: "Loading reviews…",
    error: "Could not load reviews.",
    retry: "Try again",
    featured: "Featured review",
    other: "Other reviews",
    community: "Community reviews",
    write: "Write review",
    edit: "Edit my review",
    average: "community ratings",
    empty: "No other reviews yet.",
    more: "Load more reviews",
  },
  "pt-BR": {
    loading: "Carregando resenhas…",
    error: "Não foi possível carregar as resenhas.",
    retry: "Tentar novamente",
    featured: "Resenha em destaque",
    other: "Outras resenhas",
    community: "Resenhas da comunidade",
    write: "Escrever resenha",
    edit: "Editar minha resenha",
    average: "avaliações da comunidade",
    empty: "Ainda não há outras resenhas.",
    more: "Carregar mais resenhas",
  },
  es: {
    loading: "Cargando reseñas…",
    error: "No se pudieron cargar las reseñas.",
    retry: "Reintentar",
    featured: "Reseña destacada",
    other: "Otras reseñas",
    community: "Reseñas de la comunidad",
    write: "Escribir reseña",
    edit: "Editar mi reseña",
    average: "valoraciones de la comunidad",
    empty: "Todavía no hay otras reseñas.",
    more: "Cargar más reseñas",
  },
};

export function TitleReviewContext({
  locale,
  mediaType,
  tmdbId,
  reviewId,
  selected,
  titleHref,
  onTitlePage,
  children,
}: {
  locale: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  reviewId: string | null;
  selected?: (own: Context["own"], data: Context | null) => ReactNode;
  titleHref: string;
  onTitlePage?: boolean;
  children?: ReactNode;
}) {
  const [data, setData] = useState<Context | null>(null);
  const router = useRouter();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletedSelected, setDeletedSelected] = useState(false);
  const l = labels[locale as keyof typeof labels] || labels.en;
  const t = messages(locale);
  useEffect(() => {
    let active = true;
    loadTitleReviewContext(locale, mediaType, tmdbId, reviewId)
      .then((result) => {
        if (active) {
          setData(result);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [locale, mediaType, tmdbId, reviewId, attempt]);
  const own = data?.own;
  const others = data?.reviews || [];
  const refresh = async () => {
    const updated = await loadTitleReviewContext(
      locale,
      mediaType,
      tmdbId,
      reviewId,
    );
    setData(updated);
    if (onTitlePage) router.refresh();
  };
  return (
    <CommunityEditorContext.Provider
      value={{
        own: own || null,
        editing,
        setEditing,
        locale,
        mediaType,
        tmdbId,
        userId: data?.userId || null,
        next: reviewId
          ? `${titleHref}?review=${reviewId}#review-${reviewId}`
          : titleHref,
        refresh,
        onDeleted: async (id) => {
          if (id === reviewId) setDeletedSelected(true);
          setEditing(false);
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  own: null,
                  reviews: previous.reviews.filter((r) => r.id !== id),
                  count: Math.max(0, previous.count - 1),
                  average:
                    previous.count > 1
                      ? (previous.average * previous.count -
                          (previous.own?.rating || 0)) /
                        (previous.count - 1)
                      : 0,
                }
              : previous,
          );
          if (onTitlePage) router.refresh();
          try {
            const updated = await loadTitleReviewContext(
              locale,
              mediaType,
              tmdbId,
              reviewId,
            );
            setData((previous) =>
              previous
                ? {
                    ...previous,
                    own: updated.own,
                    count: updated.count,
                    average: updated.average,
                  }
                : updated,
            );
          } catch {
            setError(true);
          }
        },
      }}
    >
      {!onTitlePage && (
        <div className="border-b border-border px-[clamp(14px,3vw,24px)] py-3 space-y-2">
          {data?.overview && <p className="text-sm">{data.overview}</p>}
          {data && (
            <p className="text-sm">
              <span className="text-primary">★</span>{" "}
              {new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(data.average)}
              /5 · {data.count} {l.average}
            </p>
          )}
        </div>
      )}
      <section
        className={
          onTitlePage
            ? "space-y-4 [overflow-wrap:anywhere]"
            : "space-y-4 p-[clamp(12px,3vw,24px)] [overflow-wrap:anywhere]"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{l.community}</h2>
          {!own && (
            <Button
              type="button"
              disabled={!data}
              aria-label={l.write}
              onClick={() => setEditing(true)}
            >
              +
            </Button>
          )}
        </div>
        {!own && <CommunityEditor />}
        {selected && !deletedSelected && (
          <ReviewCard>{selected(own || null, data)}</ReviewCard>
        )}
        {onTitlePage ? (
          children
        ) : (
          <>
            {!data && !error && <p role="status">{l.loading}</p>}
            {error && (
              <p role="alert">
                {l.error}{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  {l.retry}
                </button>
              </p>
            )}
            {data && !others.length && (
              <p className="text-sm text-subtle">{l.empty}</p>
            )}
            {others.map((r) => (
              <ReviewCard
                key={r.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage
                        src={r.profiles?.avatar_url || undefined}
                        alt=""
                      />
                      <AvatarFallback>
                        {(r.profiles?.display_name || t.member)
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <strong>
                        {r.profiles?.handle ? (
                          <Link
                            className="hover:text-primary"
                            href={`/${locale}/profile/${r.profiles.handle}`}
                          >
                            {r.profiles.display_name}
                          </Link>
                        ) : (
                          t.member
                        )}
                      </strong>
                      <FollowReviewAuthor
                        authorId={r.user_id}
                        userId={data?.userId || null}
                        followed={data?.followed.includes(r.user_id) || false}
                        locale={locale}
                      />
                      <div className="text-xs text-subtle">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </div>
                    </div>
                  </div>
                  <span className="text-primary">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}{" "}
                    <span className="text-foreground">{r.rating}/5</span>
                  </span>
                  <CommunityEditControl reviewId={r.id} />
                </div>
                {r.body && (
                  <p className="mt-3 whitespace-pre-line text-sm">{r.body}</p>
                )}
                {r.youtube_video_id && (
                  <ReviewVideo
                    url={`https://www.youtube.com/watch?v=${r.youtube_video_id}`}
                    locale={locale}
                  />
                )}
                <CommunityCardEditor reviewId={r.id} />
                <ReviewDiscussion
                  reviewId={r.id}
                  locale={locale}
                  userId={data?.userId || null}
                  initialCount={data?.summaries[r.id]?.count}
                  initialCommentCount={data?.summaries[r.id]?.commentCount}
                  initialLiked={data?.summaries[r.id]?.liked}
                />
              </ReviewCard>
            ))}
            {data?.next && (
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  setError(false);
                  try {
                    const page = await loadTitleReviewContext(
                      locale,
                      mediaType,
                      tmdbId,
                      reviewId,
                      data.next || undefined,
                    );
                    setData((previous) =>
                      previous
                        ? {
                            ...page,
                            reviews: [
                              ...new Map(
                                [...previous.reviews, ...page.reviews].map(
                                  (r) => [r.id, r],
                                ),
                              ).values(),
                            ],
                            summaries: {
                              ...previous.summaries,
                              ...page.summaries,
                            },
                            followed: [
                              ...new Set([
                                ...previous.followed,
                                ...page.followed,
                              ]),
                            ],
                          }
                        : page,
                    );
                  } catch {
                    setError(true);
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? l.loading : l.more}
              </Button>
            )}
          </>
        )}
      </section>
    </CommunityEditorContext.Provider>
  );
}
