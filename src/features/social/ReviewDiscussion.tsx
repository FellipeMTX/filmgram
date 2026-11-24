"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn } from "@/features/auth/actions";
import { useReviewPostModal } from "@/components/ReviewPost";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadReviewComments } from "./discussion-loader";
import {
  setReviewLike,
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
    comments: "Comments",
    placeholder: "Write a comment",
    submit: "Post comment",
    reply: "Reply",
    replies: "Show replies",
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
    comments: "Comentários",
    placeholder: "Escreva um comentário",
    submit: "Publicar comentário",
    reply: "Responder",
    replies: "Ver respostas",
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
    comments: "Comentarios",
    placeholder: "Escribe un comentario",
    submit: "Publicar comentario",
    reply: "Responder",
    replies: "Ver respuestas",
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
  const modalOpen = useReviewPostModal();
  const [previousModal, setPreviousModal] = useState(modalOpen);
  const [modalExpanded, setModalExpanded] = useState(true);
  if (previousModal !== modalOpen) {
    setPreviousModal(modalOpen);
    if (modalOpen) setModalExpanded(true);
  }
  const nextPath = pathname.includes("/title/")
    ? `${pathname}?review=${reviewId}`
    : pathname;
  const composer = useRef<HTMLTextAreaElement>(null);
  const [liked, setLiked] = useState(initialLiked),
    [count, setCount] = useState(initialCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [open, setOpen] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]),
    [next, setNext] = useState<Cursor>(null);
  const [replies, setReplies] = useState<
    Record<string, { comments: ReviewComment[]; next: Cursor }>
  >({});
  const [draft, setDraft] = useState(""),
    [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null),
    [editBody, setEditBody] = useState("");
  const [error, setError] = useState(false),
    [pending, start] = useTransition();
  useEffect(() => {
    if (window.location.hash !== `#review-${reviewId}`) return;
    let active = true;
    loadReviewComments(reviewId, null)
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
    if (!modalOpen || loaded) return;
    let active = true;
    loadReviewComments(reviewId, null)
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
  }, [modalOpen, loaded, reviewId]);
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
  async function load(parent: string | null, cursor?: Cursor) {
    const page = await loadReviewComments(
      reviewId,
      parent,
      cursor || undefined,
    );
    if (parent)
      setReplies((prev) => ({
        ...prev,
        [parent]: {
          comments: cursor
            ? mergeComments(prev[parent]?.comments || [], page.comments)
            : page.comments,
          next: page.nextCursor,
        },
      }));
    else {
      setComments((prev) =>
        cursor ? mergeComments(prev, page.comments) : page.comments,
      );
      setNext(page.nextCursor);
      setLoaded(true);
    }
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
    const parent = row.parentId;
    if (!parent) {
      setComments((previous) => mergeComments(previous, [row]));
    } else {
      setReplies((previous) => ({
        ...previous,
        [parent]: {
          comments: mergeComments(previous[parent]?.comments || [], [row]),
          next: previous[parent]?.next || null,
        },
      }));
    }
  }
  function actionForm(extra: Record<string, string>) {
    const f = new FormData();
    f.set("review_id", reviewId);
    Object.entries(extra).forEach(([key, value]) => f.set(key, value));
    return f;
  }
  function comment(c: ReviewComment, nested = false) {
    return (
      <div
        key={c.id}
        className={
          nested
            ? "ml-5 border-l border-border pl-3"
            : "border-t border-border pt-3"
        }
      >
        <div className="text-sm">
          {c.profile?.handle ? (
            <Link
              className="font-bold hover:text-primary"
              href={`/${locale}/profile/${c.profile.handle}`}
            >
              {c.profile.displayName || c.profile.handle}
            </Link>
          ) : (
            <strong>Filmgram</strong>
          )}
          {" · "}
          <time className="text-muted-foreground" dateTime={c.createdAt}>
            {new Date(c.createdAt).toLocaleDateString(locale)}
          </time>
        </div>
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
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              {l.cancel}
            </Button>
          </div>
        ) : (
          <p className="my-2 whitespace-pre-wrap break-words text-sm">
            {c.deletedAt ? l.removed : c.body}
          </p>
        )}
        {!c.deletedAt && (
          <div className="flex flex-wrap gap-2">
            {!nested && userId && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={() => {
                  setReplyTo(c.id);
                  composer.current?.focus();
                  if (!replies[c.id]) run(() => load(c.id));
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
                      setCommentCount((n) => Math.max(0, n - 1));
                    })
                  }
                >
                  {l.remove}
                </button>
              </>
            )}
          </div>
        )}
        {!nested && (
          <div className="mt-2 space-y-3">
            <button
              type="button"
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-primary"
              onClick={() => run(() => load(c.id))}
            >
              {l.replies}
            </button>
            {replies[c.id]?.comments.map((r) => comment(r, true))}
            {replies[c.id]?.next && (
              <button
                type="button"
                className="block text-xs text-primary"
                onClick={() => run(() => load(c.id, replies[c.id]?.next))}
              >
                {l.more}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={liked ? l.unlike : l.like}
          aria-pressed={liked}
          disabled={!userId || pending}
          className="text-sm text-primary disabled:opacity-60"
          onClick={() =>
            run(async () => {
              const summary = await setReviewLike(
                actionForm({ liked: String(!liked) }),
              );
              if (summary) {
                setCount(summary.count);
                setLiked(summary.liked);
              }
            })
          }
        >
          {liked ? "♥" : "♡"} {count}
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          className="text-sm text-muted-foreground hover:text-primary"
          onClick={() => {
            if (modalOpen) setModalExpanded(!expanded);
            else setOpen(!expanded);
            if (!loaded) run(() => load(null));
          }}
        >
          {l.comments} ({commentCount})
        </button>
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
              onClick={() => run(() => load(null, next))}
            >
              {l.more}
            </Button>
          )}
          {userId ? (
            <div className="space-y-2">
              {replyTo && (
                <p className="text-xs text-muted-foreground">
                  {l.reply}{" "}
                  <button type="button" onClick={() => setReplyTo(null)}>
                    {l.cancel}
                  </button>
                </p>
              )}
              <Textarea
                ref={composer}
                disabled={pending}
                aria-label={l.placeholder}
                placeholder={l.placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button
                size="sm"
                disabled={pending || !draft.trim()}
                onClick={() =>
                  run(async () => {
                    mergeComment(
                      await createReviewComment(
                        actionForm({
                          body: draft,
                          ...(replyTo ? { parent_id: replyTo } : {}),
                        }),
                      ),
                    );
                    setCommentCount((n) => n + 1);
                    setDraft("");
                    setReplyTo(null);
                  })
                }
              >
                {pending ? l.sending : l.submit}
              </Button>
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
