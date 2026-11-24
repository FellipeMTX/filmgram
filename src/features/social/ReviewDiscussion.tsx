"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn } from "@/features/auth/actions";
import { useReviewPostModal } from "@/components/ReviewPost";
import { Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadReviewComments } from "./discussion-loader";
import {
  setReviewLike,
  setReviewCommentLike,
  createReviewComment,
  updateReviewComment,
  deleteReviewComment,
} from "./review-discussion-actions";
import type { ReviewComment } from "./review-discussion-queries";

type Cursor = { createdAt: string; id: string } | null;
const labels = {
  en: {
    like: "Like review",
    unlike: "Unlike review",
    likeComment: "Like comment",
    unlikeComment: "Unlike comment",
    commentLikes: (n: number) => `${n} ${n === 1 ? "like" : "likes"}`,
    comments: "Comments",
    placeholder: "Write a comment",
    submit: "Post comment",
    reply: "Reply",
    replyingTo: "Replying to",
    more: "Load more comments",
    removed: "Comment removed",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    remove: "Delete",
    login: "Sign in to join the discussion",
    error: "Something went wrong. Please try again.",
    sending: "Saving…",
  },
  "pt-BR": {
    like: "Curtir resenha",
    unlike: "Descurtir resenha",
    likeComment: "Curtir comentário",
    unlikeComment: "Descurtir comentário",
    commentLikes: (n: number) => `${n} ${n === 1 ? "curtida" : "curtidas"}`,
    comments: "Comentários",
    placeholder: "Escreva um comentário",
    submit: "Publicar comentário",
    reply: "Responder",
    replyingTo: "Respondendo a",
    more: "Carregar mais comentários",
    removed: "Comentário removido",
    edit: "Editar",
    save: "Salvar",
    cancel: "Cancelar",
    remove: "Excluir",
    login: "Entre para participar da conversa",
    error: "Algo deu errado. Tente novamente.",
    sending: "Salvando…",
  },
  es: {
    like: "Me gusta la reseña",
    unlike: "Ya no me gusta",
    likeComment: "Me gusta el comentario",
    unlikeComment: "Ya no me gusta el comentario",
    commentLikes: (n: number) => `${n} me gusta`,
    comments: "Comentarios",
    placeholder: "Escribe un comentario",
    submit: "Publicar comentario",
    reply: "Responder",
    replyingTo: "Respondiendo a",
    more: "Cargar más comentarios",
    removed: "Comentario eliminado",
    edit: "Editar",
    save: "Guardar",
    cancel: "Cancelar",
    remove: "Eliminar",
    login: "Inicia sesión para participar",
    error: "Algo salió mal. Inténtalo de nuevo.",
    sending: "Guardando…",
  },
};

function relativeTime(date: string, locale: string) {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, divisor] = units.find(
    ([, size]) => Math.abs(seconds) >= size,
  ) || ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / divisor),
    unit,
  );
}

export function ReviewDiscussion({
  reviewId,
  locale,
  userId,
  initialCount = 0,
  initialCommentCount = 0,
  initialLiked = false,
  detailHref,
}: {
  reviewId: string;
  locale: string;
  userId: string | null;
  initialCount?: number;
  initialCommentCount?: number;
  initialLiked?: boolean;
  detailHref?: string;
}) {
  const l = labels[locale as keyof typeof labels] || labels.en;
  const pathname = usePathname();
  const modal = useReviewPostModal();
  const modalOpen = modal.open;
  const [open, setOpen] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [previousModal, setPreviousModal] = useState(modalOpen);
  const [modalExpanded, setModalExpanded] = useState(true);
  if (previousModal !== modalOpen) {
    setPreviousModal(modalOpen);
    if (modalOpen) setModalExpanded(modal.mode === "discussion" || open);
  }
  const nextPath = pathname.includes("/title/")
    ? `${pathname}?review=${reviewId}`
    : pathname;
  const composer = useRef<HTMLTextAreaElement>(null);
  const [liked, setLiked] = useState(initialLiked),
    [count, setCount] = useState(initialCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          reviewId: string;
          count?: number;
          liked?: boolean;
          commentDelta?: number;
        }>
      ).detail;
      if (!detail || detail.reviewId !== reviewId) return;
      if (detail.count !== undefined) setCount(detail.count);
      if (detail.liked !== undefined) setLiked(detail.liked);
      if (detail.commentDelta)
        setCommentCount((n) => Math.max(0, n + detail.commentDelta!));
    };
    window.addEventListener("filmgram-review-change", receive);
    return () => window.removeEventListener("filmgram-review-change", receive);
  }, [reviewId]);
  const publishChange = (change: {
    count?: number;
    liked?: boolean;
    commentDelta?: number;
  }) =>
    window.dispatchEvent(
      new CustomEvent("filmgram-review-change", {
        detail: { reviewId, ...change },
      }),
    );
  const [comments, setComments] = useState<ReviewComment[]>([]),
    [next, setNext] = useState<Cursor>(null);
  const [draft, setDraft] = useState(""),
    [replyTo, setReplyTo] = useState<ReviewComment | null>(null);
  const mentionPrefix = replyTo?.profile?.handle
    ? `@${replyTo.profile.handle} `
    : "";
  const commentBody =
    mentionPrefix && draft.startsWith(mentionPrefix)
      ? draft.slice(mentionPrefix.length)
      : draft;
  const [editing, setEditing] = useState<string | null>(null),
    [editBody, setEditBody] = useState("");
  const [error, setError] = useState(false),
    [pending, start] = useTransition();
  useEffect(() => {
    if (window.location.hash !== `#review-${reviewId}`) return;
    let active = true;
    loadReviewComments(reviewId)
      .then((page) => {
        if (active) {
          setOpen(true);
          setComments(page.comments);
          setNext(page.nextCursor);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [reviewId]);
  useEffect(() => {
    if (!modalOpen || modal.mode !== "discussion" || loaded) return;
    let active = true;
    loadReviewComments(reviewId)
      .then((page) => {
        if (active) {
          setComments(page.comments);
          setNext(page.nextCursor);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [modalOpen, modal.mode, loaded, reviewId]);
  const expanded = modalOpen ? modalExpanded : open;
  function run(fn: () => Promise<void>) {
    if (pending) return;
    setError(false);
    start(async () => {
      try {
        await fn();
      } catch {
        setError(true);
      }
    });
  }
  async function load(cursor?: Cursor) {
    const page = await loadReviewComments(reviewId, cursor || undefined);
    setComments((prev) =>
      cursor ? mergeComments(prev, page.comments) : page.comments,
    );
    setNext(page.nextCursor);
    setLoaded(true);
  }
  function mergeComments(current: ReviewComment[], incoming: ReviewComment[]) {
    return [
      ...new Map(
        [...current, ...incoming].map((item) => [item.id, item]),
      ).values(),
    ].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }
  function mergeComment(row: ReviewComment) {
    setComments((previous) =>
      mergeComments(previous, [row]).map((item) =>
        row.deletedAt && item.parentId === row.id
          ? { ...item, replyToHandle: null }
          : item,
      ),
    );
    if (row.deletedAt && replyTo?.id === row.id) {
      setDraft(commentBody);
      setReplyTo(null);
    }
  }
  function actionForm(extra: Record<string, string>) {
    const f = new FormData();
    f.set("review_id", reviewId);
    Object.entries(extra).forEach(([key, value]) => f.set(key, value));
    return f;
  }
  function comment(c: ReviewComment) {
    return (
      <div
        key={c.id}
        data-comment-id={c.id}
        className="flex gap-2 border-t border-border pt-3"
      >
        <Avatar size="sm">
          <AvatarImage src={c.profile?.avatarUrl || undefined} alt="" />
          <AvatarFallback aria-hidden="true">
            {c.profile?.displayName
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((name) => name[0])
              .join("")
              .toUpperCase() || "·"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-relaxed">
            {c.profile?.handle ? (
              <Link
                className="font-bold hover:text-primary"
                href={`/${locale}/profile/${c.profile.handle}`}
              >
                {c.profile.displayName || c.profile.handle}
              </Link>
            ) : (
              <strong>Filmgram</strong>
            )}{" "}
            {editing === c.id ? (
              <div className="my-2 space-y-2">
                <Textarea
                  aria-label={l.edit}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={pending || !editBody.trim()}
                  onClick={() =>
                    run(async () => {
                      mergeComment(
                        await updateReviewComment(
                          actionForm({ comment_id: c.id, body: editBody }),
                        ),
                      );
                      setEditing(null);
                    })
                  }
                >
                  {l.save}
                </Button>{" "}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  {l.cancel}
                </Button>
              </div>
            ) : (
              <span className="whitespace-pre-wrap break-words">
                {!c.deletedAt && (c.parentId || c.replyToHandle) && (
                  <>
                    {c.replyToHandle ? (
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/${locale}/profile/${c.replyToHandle}`}
                      >
                        @{c.replyToHandle}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        [{l.removed}]
                      </span>
                    )}{" "}
                  </>
                )}
                {c.deletedAt ? l.removed : c.body}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <time
              dateTime={c.createdAt}
              title={new Date(c.createdAt).toLocaleString(locale)}
            >
              {relativeTime(c.createdAt, locale)}
            </time>
            <span>{l.commentLikes(c.likeCount)}</span>
            {!c.deletedAt && (
              <>
                {c.profile?.handle && userId && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary"
                    onClick={() => {
                      const priorPrefix = replyTo?.profile?.handle
                        ? `@${replyTo.profile.handle} `
                        : "";
                      const existing =
                        priorPrefix && draft.startsWith(priorPrefix)
                          ? draft.slice(priorPrefix.length)
                          : draft;
                      const prefix = `@${c.profile!.handle} `;
                      setDraft(prefix + existing);
                      setReplyTo(c);
                      requestAnimationFrame(() => {
                        composer.current?.focus();
                        composer.current?.setSelectionRange(
                          prefix.length,
                          prefix.length,
                        );
                      });
                    }}
                  >
                    {l.reply}
                  </button>
                )}
                {userId && userId === c.userId && (
                  <>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setEditing(c.id);
                        setEditBody(c.body || "");
                      }}
                    >
                      {l.edit}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-primary"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          mergeComment(
                            await deleteReviewComment(
                              actionForm({ comment_id: c.id }),
                            ),
                          );
                          publishChange({ commentDelta: -1 });
                        })
                      }
                    >
                      {l.remove}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {!c.deletedAt && (
          <button
            type="button"
            aria-label={c.liked ? l.unlikeComment : l.likeComment}
            aria-pressed={c.liked}
            disabled={!userId || pending}
            className="self-start p-1 text-muted-foreground hover:text-primary aria-pressed:text-primary disabled:opacity-60"
            onClick={() =>
              run(async () => {
                const summary = await setReviewCommentLike(
                  actionForm({ comment_id: c.id, liked: String(!c.liked) }),
                );
                setComments((previous) =>
                  previous.map((item) =>
                    item.id === c.id
                      ? {
                          ...item,
                          likeCount: summary.count,
                          liked: summary.liked,
                        }
                      : item,
                  ),
                );
              })
            }
          >
            <Heart
              aria-hidden="true"
              size={17}
              className={c.liked ? "fill-current" : ""}
            />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-label={liked ? l.unlike : l.like}
          aria-pressed={liked}
          disabled={!userId || pending}
          className="min-h-9 aria-pressed:border-primary/70 aria-pressed:bg-primary/15 aria-pressed:text-primary pointer-coarse:min-h-11"
          onClick={() =>
            run(async () => {
              const summary = await setReviewLike(
                actionForm({ liked: String(!liked) }),
              );
              if (summary) {
                publishChange({ count: summary.count, liked: summary.liked });
              }
            })
          }
        >
          <Heart aria-hidden="true" className={liked ? "fill-current" : ""} />{" "}
          {count}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-expanded={expanded}
          className="min-h-9 aria-expanded:border-primary/70 aria-expanded:bg-primary/15 aria-expanded:text-primary pointer-coarse:min-h-11"
          onClick={(event) => {
            if (modal.feed && !modalOpen && modal.openDiscussion) {
              modal.openDiscussion(event.currentTarget);
              return;
            }
            if (modalOpen) setModalExpanded(!expanded);
            else setOpen(!expanded);
            if (!loaded) run(() => load());
          }}
        >
          <MessageCircle aria-hidden="true" />{" "}
          {modal.feed && !modalOpen
            ? locale === "pt-BR"
              ? "Abrir discussão"
              : locale === "es"
                ? "Abrir discusión"
                : "Open discussion"
            : l.comments}{" "}
          ({commentCount})
        </Button>
      </div>
      {expanded && (
        <div className="space-y-3">
          {detailHref && (
            <Link
              className="block text-sm text-primary hover:underline"
              href={detailHref}
            >
              {locale === "pt-BR"
                ? "Ver esta resenha na página do título"
                : locale === "es"
                  ? "Ver esta reseña en la página del título"
                  : "View this review on the title page"}
            </Link>
          )}
          {comments.map((c) => comment(c))}
          {next && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => load(next))}
            >
              {l.more}
            </Button>
          )}
          {userId ? (
            <div className="space-y-2">
              {replyTo && (
                <p
                  id={`reply-target-${reviewId}`}
                  className="text-xs text-muted-foreground"
                  role="status"
                >
                  {l.replyingTo} @{replyTo.profile?.handle}
                </p>
              )}
              <Textarea
                ref={composer}
                className="w-full"
                disabled={pending}
                aria-label={l.placeholder}
                aria-describedby={
                  replyTo ? `reply-target-${reviewId}` : undefined
                }
                placeholder={l.placeholder}
                value={draft}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft(value);
                  if (replyTo && !value.startsWith(mentionPrefix))
                    setReplyTo(null);
                }}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending || (!replyTo && !draft)}
                  onClick={() => {
                    if (replyTo) {
                      setDraft(commentBody);
                      setReplyTo(null);
                    } else setDraft("");
                    composer.current?.focus();
                  }}
                >
                  {l.cancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !commentBody.trim()}
                  onClick={() =>
                    run(async () => {
                      mergeComment(
                        await createReviewComment(
                          actionForm({
                            body: commentBody,
                            ...(replyTo
                              ? { target_comment_id: replyTo.id }
                              : {}),
                          }),
                        ),
                      );
                      publishChange({ commentDelta: 1 });
                      setDraft("");
                      setReplyTo(null);
                    })
                  }
                >
                  {pending ? l.sending : l.submit}
                </Button>
              </div>
            </div>
          ) : (
            <form action={signIn}>
              <input
                type="hidden"
                name="next"
                value={`${nextPath}#review-${reviewId}`}
              />
              <Button type="submit" size="sm" variant="outline">
                {l.login}
              </Button>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {l.error}
        </p>
      )}
    </div>
  );
}
