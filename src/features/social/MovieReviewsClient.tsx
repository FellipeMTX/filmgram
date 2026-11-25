"use client";

import { useRef, useState } from "react";
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
import { loadMovieReviewPage } from "./movie-review-page";
import type { loadTitleReviewContext } from "./title-review-context";

type Page = Awaited<ReturnType<typeof loadMovieReviewPage>>;
type Own = Awaited<ReturnType<typeof loadTitleReviewContext>>["own"];
export type MovieReviewsProps = {
  locale: string;
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
    edit: "Edit my review",
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
    edit: "Editar minha resenha",
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
    edit: "Editar mi reseña",
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
  const { locale, tmdbId, reviewId, userId } = props;
  const l = labels[locale as keyof typeof labels] || labels.en;
  const t = messages(locale);
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ page: Page; order: string } | null>(
    null,
  );
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const order = props.initialPage.reviews
    .map((row) => row.id + ":" + row.followed)
    .join(",");
  const extra = loaded?.order === order ? loaded.page : null;
  const own = props.own?.id === deletedId ? null : props.own;
  const initialIds = new Set(props.initialPage.reviews.map((row) => row.id));
  const reviews = [
    ...props.initialPage.reviews,
    ...(extra?.reviews.filter(
      (row, index, rows) =>
        !initialIds.has(row.id) &&
        rows.findIndex((candidate) => candidate.id === row.id) === index,
    ) || []),
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
  const summaries = { ...extra?.summaries, ...props.initialPage.summaries };
  const ownRow =
    props.ownSeparate && own
      ? reviews.find((row) => row.id === own.id)
      : undefined;
  const communityReviews = ownRow
    ? reviews.filter((row) => row.id !== ownRow.id)
    : reviews;
  const next = extra ? extra.next : props.initialPage.next;
  const [editingTrigger, setEditingTrigger] = useState<HTMLElement | null>(
    null,
  );
  const guardRef = useRef<(() => boolean) | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [pageError, setPageError] = useState(false);
  const error = props.initialError || pageError;
  useRestoreReviewDraft(
    userId,
    "movie",
    tmdbId,
    !props.initialError && !props.preview,
    sectionRef,
  );

  async function loadMore() {
    if (!next || pending) return;
    setPending(true);
    setPageError(false);
    try {
      const more = await loadMovieReviewPage(tmdbId, reviewId, next);
      setLoaded({
        order,
        page: {
          ...more,
          reviews: [
            ...new Map(
              [...(extra?.reviews || []), ...more.reviews].map((row) => [
                row.id,
                row,
              ]),
            ).values(),
          ],
          summaries: { ...extra?.summaries, ...more.summaries },
        },
      });
    } catch {
      setPageError(true);
    } finally {
      setPending(false);
    }
  }

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
        mediaType: "movie",
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
            <h2 className="font-display text-[clamp(1.65rem,3.2vw,2.5rem)] leading-tight font-bold">
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
        {(ownRow ? [ownRow, ...communityReviews] : communityReviews).map(
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
                mediaType="movie"
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
              onClick={props.initialError ? () => router.refresh() : loadMore}
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
