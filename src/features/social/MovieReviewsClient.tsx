"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { ReviewPost } from "@/components/ReviewPost";
import { FilmgramRating } from "@/components/FilmgramRating";
import { Button } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import {
  CommunityEditorContext,
  CommunityEditor,
  useRestoreReviewDraft,
} from "./CommunityEditor";
import { ReviewDiscussion } from "./ReviewDiscussion";
import { loadTitleReviewPage } from "./title-review-page";
import { movieReviewId } from "@/features/catalog/movie-section-links";
import type { loadTitleReviewContext } from "./title-review-context";
import { useMovieReviewPages } from "./useMovieReviewPages";

type Page = Awaited<ReturnType<typeof loadTitleReviewPage>>;
type Own = Awaited<ReturnType<typeof loadTitleReviewContext>>["own"];
export type MovieReviewsProps = {
  locale: string;
  mediaType?: "movie" | "tv";
  tmdbId: number;
  reviewId: string | null;
  title: string;
  year: string | number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  titleHref: string;
  average: number;
  count: number;
  userId: string | null;
  preview?: boolean;
  reviewsHref?: string;
};

const labels = {
  en: {
    title: "Community reviews",
    write: "Write review",
    average: "community ratings",
    empty: "No reviews yet.",
    noRatings: "No Filmgram ratings yet",
    more: "Load more",
    all: "View all reviews",
    loading: "Loading…",
    error: "Could not load reviews.",
    retry: "Try again",
    yours: "Your review",
  },
  "pt-BR": {
    title: "Resenhas da comunidade",
    write: "Escrever resenha",
    average: "avaliações da comunidade",
    empty: "Ainda não há resenhas.",
    noRatings: "Ainda não há avaliações Filmgram",
    more: "Ver mais",
    all: "Ver todas",
    loading: "Carregando…",
    error: "Não foi possível carregar as resenhas.",
    retry: "Tentar novamente",
    yours: "Sua resenha",
  },
  es: {
    title: "Reseñas de la comunidad",
    write: "Escribir reseña",
    average: "valoraciones de la comunidad",
    empty: "Todavía no hay reseñas.",
    noRatings: "Todavía no hay valoraciones Filmgram",
    more: "Ver más",
    all: "Ver todas",
    loading: "Cargando…",
    error: "No se pudieron cargar las reseñas.",
    retry: "Reintentar",
    yours: "Tu reseña",
  },
};

export function MovieReviewsClient(
  props: MovieReviewsProps & {
    initialPage: Page;
    own: Own;
    initialError?: boolean;
    ownSeparate?: boolean;
  },
) {
  const { locale, tmdbId, userId } = props;
  const mediaType = props.mediaType || "movie";
  const [hashReview, setHashReview] = useState<string | null>(null);
  useEffect(() => {
    const update = () =>
      setHashReview(
        movieReviewId(
          window.location.hash.startsWith("#review-")
            ? window.location.hash.slice(8)
            : null,
        ),
      );
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const reviewId = props.reviewId || hashReview;
  const l = labels[locale as keyof typeof labels] || labels.en;
  const t = messages(locale);
  const router = useRouter();
  const {
    page,
    first,
    pending,
    error: pageError,
    refresh,
    loadMore,
  } = useMovieReviewPages(
    props.initialPage,
    tmdbId,
    reviewId,
    props.preview,
    mediaType,
  );
  useEffect(() => {
    if (
      hashReview &&
      !props.reviewId &&
      !props.initialPage.reviews.some((row) => row.id === hashReview)
    )
      void refresh();
  }, [hashReview, props.reviewId, props.initialPage, refresh]);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const own = props.own?.id === deletedId ? null : props.own;
  const ownFallback =
    own && props.initialPage.reviews.find((row) => row.id === own.id);
  const ownInPage = own && page.reviews.some((row) => row.id === own.id);
  const reviews = [
    ...page.reviews,
    ...(!ownInPage && ownFallback ? [ownFallback] : []),
  ]
    .filter((row) => row.id !== deletedId)
    .map((row) =>
      row.id === own?.id
        ? {
            ...row,
            rating: own.rating,
            body: own.body,
            body_document: own.body_document,
            youtube_video_id: own.youtube_video_id,
          }
        : row,
    );
  const summaries = { ...props.initialPage.summaries, ...page.summaries };
  const ownSeparate =
    own &&
    (!first.reviews.some((row) => row.id === own.id) ||
      (first.selectedOutsidePage && reviewId === own.id) ||
      (first === props.initialPage && props.ownSeparate));
  const ownRow =
    ownSeparate && own ? reviews.find((row) => row.id === own.id) : undefined;
  const timestamp = (value: string) =>
    value.replace(
      /(\.\d+)?(?:\+00:00|Z)$/,
      (_, fraction: string | undefined) =>
        (fraction || ".").padEnd(7, "0") + "Z",
    );
  const communityReviews = (
    ownRow ? reviews.filter((row) => row.id !== ownRow.id) : reviews
  ).sort((a, b) => {
    const left = timestamp(a.created_at),
      right = timestamp(b.created_at);
    return (
      Number(b.followed) - Number(a.followed) ||
      (right > left ? 1 : right < left ? -1 : 0) ||
      (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)
    );
  });
  const next = page.next;
  const scrolledTarget = useRef<string | null>(null);
  useEffect(() => {
    if (
      mediaType !== "tv" ||
      !reviewId ||
      scrolledTarget.current === reviewId ||
      !reviews.some((row) => row.id === reviewId)
    )
      return;
    const target = document.getElementById(`review-${reviewId}`);
    if (target) {
      scrolledTarget.current = reviewId;
      target.scrollIntoView({ block: "start" });
    }
  }, [mediaType, reviewId, reviews]);
  const [editingTrigger, setEditingTrigger] = useState<HTMLElement | null>(
    null,
  );
  const guardRef = useRef<(() => boolean) | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    sectionRef.current?.setAttribute("data-reviews-hydrated", "true");
  }, []);
  const followFocusRef = useRef<HTMLElement | null>(null);
  const error = props.initialError || pageError;
  useEffect(() => {
    let observer: MutationObserver | null = null;
    const onFollow = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string }>).detail;
      if (!userId || !detail?.key.startsWith(`${userId}:`)) return;
      const active = document.activeElement;
      followFocusRef.current =
        active instanceof HTMLElement && sectionRef.current?.contains(active)
          ? active
          : null;
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) void refresh();
      else {
        observer?.disconnect();
        observer = new MutationObserver(() => {
          if (!dialog.isConnected) {
            observer?.disconnect();
            void refresh();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };
    window.addEventListener("filmgram-follow-change", onFollow);
    return () => {
      observer?.disconnect();
      window.removeEventListener("filmgram-follow-change", onFollow);
    };
  }, [refresh, userId]);
  useEffect(() => {
    if (pending || !followFocusRef.current) return;
    if (!followFocusRef.current.isConnected) headingRef.current?.focus();
    followFocusRef.current = null;
  }, [pending, page]);
  useRestoreReviewDraft(
    userId,
    mediaType,
    tmdbId,
    !props.initialError && !props.preview,
    sectionRef,
  );

  return (
    <CommunityEditorContext.Provider
      value={{
        own,
        editingTrigger,
        setEditingTrigger,
        guardRef,
        registerGuard: (guard) => {
          guardRef.current = guard;
        },
        locale,
        mediaType,
        tmdbId,
        userId,
        next: props.titleHref,
        refresh: async () => {
          router.refresh();
        },
        onDeleted: async (id) => {
          setDeletedId(id);
          setEditingTrigger(null);
          router.refresh();
        },
      }}
    >
      <div
        ref={sectionRef}
        data-movie-reviews-ready={props.initialError ? undefined : true}
        className="[overflow-wrap:anywhere]"
      >
        <div className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-[clamp(1.65rem,3.2vw,2.5rem)] leading-tight font-bold"
            >
              {l.title}
            </h2>
            {props.preview && props.reviewsHref && (
              <Link
                href={props.reviewsHref}
                className="font-semibold text-primary hover:underline"
              >
                {l.all}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {props.count > 0 ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">Filmgram</span>
                <FilmgramRating
                  value={props.average}
                  locale={locale}
                  className="text-lg text-primary"
                />
                <span className="text-xs text-subtle">
                  {props.count} {l.average}
                </span>
              </div>
            ) : (
              <p className="text-sm text-subtle">{l.noRatings}</p>
            )}
            {!props.preview && !props.initialError && !own && (
              <Button
                type="button"
                data-review-open
                onClick={(event) => setEditingTrigger(event.currentTarget)}
              >
                <Pencil aria-hidden className="size-4" />
                {l.write}
              </Button>
            )}
          </div>
        </div>
        {(!own || !reviews.some((row) => row.id === own.id)) && (
          <CommunityEditor />
        )}
        {!error && !reviews.length && (
          <p className="mt-4 text-muted-foreground">{l.empty}</p>
        )}
        {(ownRow ? [...communityReviews, ownRow] : communityReviews).map(
          (row) => (
            <section
              key={row.id}
              aria-label={row.id === ownRow?.id ? l.yours : undefined}
            >
              {row.id === ownRow?.id && (
                <h3 className="mt-4 text-lg font-bold">{l.yours}</h3>
              )}
              <ReviewPost
                reviewId={row.id}
                tmdbId={tmdbId}
                locale={locale}
                authorId={row.user_id}
                viewerId={userId}
                followed={row.followed}
                placement="title"
                mediaType={mediaType}
                author={{
                  name: row.display_name || t.member,
                  href: row.handle
                    ? "/" + locale + "/profile/" + row.handle
                    : undefined,
                  avatarUrl: row.avatar_url,
                }}
                date={new Date(row.created_at).toLocaleDateString(locale, {
                  timeZone: "UTC",
                })}
                title={props.title}
                year={props.year || undefined}
                rating={row.rating}
                text={row.body || ""}
                content={row.body_document}
                titleHref={props.titleHref}
                backdropUrl={props.backdropUrl}
                posterUrl={props.posterUrl}
                trailerUrl={
                  row.youtube_video_id
                    ? "https://www.youtube.com/watch?v=" + row.youtube_video_id
                    : null
                }
                interaction={
                  <ReviewDiscussion
                    reviewId={row.id}
                    locale={locale}
                    userId={userId}
                    initialCount={summaries[row.id]?.count}
                    initialCommentCount={summaries[row.id]?.commentCount}
                    initialLiked={summaries[row.id]?.liked}
                  />
                }
              />
            </section>
          ),
        )}
        {error && (
          <p role="alert" className="mt-4">
            {l.error}{" "}
            <button
              type="button"
              className="text-primary underline"
              disabled={pending}
              onClick={
                props.initialError
                  ? () => router.refresh()
                  : pageError === "refresh"
                    ? refresh
                    : loadMore
              }
            >
              {l.retry}
            </button>
          </p>
        )}
        {!props.preview && next && !pageError && (
          <Button
            variant="outline"
            className="mt-4"
            disabled={pending}
            onClick={loadMore}
          >
            {pending ? l.loading : l.more}
          </Button>
        )}
      </div>
    </CommunityEditorContext.Provider>
  );
}
