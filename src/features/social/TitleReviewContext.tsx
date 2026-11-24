"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { messages } from "@/i18n/messages";
import { submitReviewFromModal } from "./actions";
import { signIn } from "@/features/auth/actions";
import { loadTitleReviewContext } from "./title-review-context";
import { ReviewDiscussion } from "./ReviewDiscussion";

type Context = Awaited<ReturnType<typeof loadTitleReviewContext>>;
const labels = {
  en: {
    loading: "Loading reviews…",
    error: "Could not load reviews.",
    retry: "Try again",
    featured: "Featured review",
    other: "Other reviews",
    community: "Community reviews",
    write: "Write my review",
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
    write: "Escrever minha resenha",
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
    write: "Escribir mi reseña",
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
}: {
  locale: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  reviewId: string;
  selected: (own: Context["own"]) => ReactNode;
  titleHref: string;
  onTitlePage?: boolean;
}) {
  const [data, setData] = useState<Context | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
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
  return (
    <>
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
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setEditing(true)}>
            {own ? l.edit : l.write}
          </Button>
          {!onTitlePage && (
            <Link
              href={titleHref}
              className="text-sm text-subtle hover:text-primary"
            >
              {locale === "en" ? "View title" : "Ver ficha"} ↗
            </Link>
          )}
        </div>
        {editing &&
          (data?.userId ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving) return;
                const form = new FormData(event.currentTarget);
                setSaveError(false);
                setSaving(true);
                try {
                  await submitReviewFromModal(form);
                  const updated = await loadTitleReviewContext(
                    locale,
                    mediaType,
                    tmdbId,
                    reviewId,
                  );
                  setData(updated);
                  setEditing(false);
                } catch {
                  setSaveError(true);
                } finally {
                  setSaving(false);
                }
              }}
              className="space-y-3 rounded-lg border border-primary/50 bg-background p-3"
            >
              <input type="hidden" name="media_type" value={mediaType} />
              <input type="hidden" name="tmdb_id" value={tmdbId} />
              <label className="block text-sm font-bold">
                {t.yourRating}
                <NativeSelect
                  name="rating"
                  required
                  defaultValue={own?.rating || ""}
                >
                  <option value="" disabled>
                    ☆ ☆ ☆ ☆ ☆
                  </option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)} ({n}/5)
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="block text-sm font-bold">
                {t.writeReview}
                <Textarea name="body" rows={4} defaultValue={own?.body || ""} />
              </label>
              <label className="block text-sm font-bold">
                {t.addVideo}
                <Input
                  name="youtube"
                  type="url"
                  defaultValue={
                    own?.youtube_video_id
                      ? `https://www.youtube.com/watch?v=${own.youtube_video_id}`
                      : ""
                  }
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? l.loading : t.publish}
              </Button>{" "}
              {saveError && (
                <p role="alert" className="text-sm text-destructive">
                  {l.error} {l.retry}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                {locale === "en" ? "Cancel" : "Cancelar"}
              </Button>
            </form>
          ) : (
            <form action={signIn}>
              <input
                type="hidden"
                name="next"
                value={`${titleHref}?review=${reviewId}#review-${reviewId}`}
              />
              <Button type="submit" variant="outline">
                {t.signInPrompt}
              </Button>
            </form>
          ))}
      </div>
      <section className="space-y-4 p-[clamp(12px,3vw,24px)] [overflow-wrap:anywhere]">
        <h2 className="font-display text-2xl font-bold">{l.community}</h2>
        <article className="rounded-xl border border-primary/50 bg-card p-4">
          <p className="mb-2 text-xs font-bold text-primary">{l.featured}</p>
          {selected(own || null)}
        </article>
        <h3 className="border-t border-border pt-4 font-display text-xl font-bold">
          {l.other}
        </h3>
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
          <article
            key={r.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap justify-between gap-2 text-sm">
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
                <div className="text-xs text-subtle">
                  {new Date(r.created_at).toLocaleDateString(locale)}
                </div>
              </div>
              <span className="text-primary">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}{" "}
                <span className="text-foreground">{r.rating}/5</span>
              </span>
            </div>
            {r.body && (
              <p className="mt-3 whitespace-pre-line text-sm">{r.body}</p>
            )}
            {r.youtube_video_id && (
              <a
                className="mt-2 inline-block text-sm text-primary"
                href={`https://www.youtube.com/watch?v=${r.youtube_video_id}`}
                target="_blank"
                rel="noreferrer"
              >
                YouTube ↗
              </a>
            )}
            <ReviewDiscussion
              reviewId={r.id}
              locale={locale}
              userId={data?.userId || null}
              initialCount={data?.summaries[r.id]?.count}
              initialCommentCount={data?.summaries[r.id]?.commentCount}
              initialLiked={data?.summaries[r.id]?.liked}
            />
          </article>
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
                            [...previous.reviews, ...page.reviews].map((r) => [
                              r.id,
                              r,
                            ]),
                          ).values(),
                        ],
                        summaries: { ...previous.summaries, ...page.summaries },
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
      </section>
    </>
  );
}
