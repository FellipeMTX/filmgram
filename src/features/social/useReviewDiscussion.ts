import { movieReviewId } from "@/features/catalog/movie-section-links";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useReviewPostModal } from "@/components/ReviewPost";
import {
  createReviewComment,
  setReviewLike,
  setReviewCommentLike,
  updateReviewComment,
  deleteReviewComment,
} from "./review-discussion-actions";
import { loadReviewComments } from "./discussion-loader";
import type { ReviewComment } from "./review-discussion-queries";
type Cursor = { createdAt: string; id: string } | null;
export function useReviewDiscussion({
  reviewId,
  initialCount = 0,
  initialCommentCount = 0,
  initialLiked = false,
}: {
  reviewId: string;
  initialCount?: number;
  initialCommentCount?: number;
  initialLiked?: boolean;
}) {
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
  const composer = useRef<HTMLTextAreaElement>(null);
  const [liked, setLiked] = useState(initialLiked),
    [count, setCount] = useState(initialCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const attemptRef = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          reviewId: string;
          count?: number;
          liked?: boolean;
          commentCount?: number;
        }>
      ).detail;
      if (!detail || detail.reviewId !== reviewId) return;
      if (detail.count !== undefined) setCount(detail.count);
      if (detail.liked !== undefined) setLiked(detail.liked);
      if (detail.commentCount !== undefined)
        setCommentCount(detail.commentCount);
    };
    window.addEventListener("filmgram-review-change", receive);
    return () => window.removeEventListener("filmgram-review-change", receive);
  }, [reviewId]);
  const publishChange = (change: {
    count?: number;
    liked?: boolean;
    commentCount?: number;
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
    let active = true;
    let openedForLocation = false;
    let loadingTarget = false;
    function isLocationTarget() {
      const location = window.location;
      if (location.hash !== "#review-" + reviewId) return false;
      if (!/^\/[^/]+\/title\/(?:movie|tv)\/\d+\/?$/.test(location.pathname))
        return true;
      const query = new URLSearchParams(location.search).get("review");
      return query === null || movieReviewId(query) === reviewId;
    }
    const openTarget = () => {
      if (!isLocationTarget()) {
        if (openedForLocation) {
          openedForLocation = false;
          setOpen(false);
        }
        return;
      }
      if (loadingTarget || openedForLocation) return;
      loadingTarget = true;
      loadReviewComments(reviewId)
        .then((page) => {
          if (!active || !isLocationTarget()) return;
          openedForLocation = true;
          setOpen(true);
          setComments(page.comments);
          setNext(page.nextCursor);
          setLoaded(true);
        })
        .catch(() => {
          if (active && isLocationTarget()) setError(true);
        })
        .finally(() => {
          loadingTarget = false;
        });
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    window.addEventListener("popstate", openTarget);
    return () => {
      active = false;
      window.removeEventListener("hashchange", openTarget);
      window.removeEventListener("popstate", openTarget);
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
  function cancelAttempt() {
    attemptRef.current = null;
  }
  function submitComment() {
    run(async () => {
      const fingerprint = JSON.stringify([
        reviewId,
        commentBody,
        replyTo?.id ?? null,
      ]);
      if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint)
        attemptRef.current = {
          fingerprint,
          id: crypto.randomUUID(),
        };
      const result = await createReviewComment(
        actionForm({
          body: commentBody,
          attempt_id: attemptRef.current.id,
          ...(replyTo ? { target_comment_id: replyTo.id } : {}),
        }),
      );
      attemptRef.current = null;
      mergeComment(result.comment);
      publishChange({ commentCount: result.commentCount });
      setDraft("");
      setReplyTo(null);
    });
  }
  function toggleReviewLike() {
    run(async () => {
      const summary = await setReviewLike(
        actionForm({ liked: String(!liked) }),
      );
      if (summary)
        publishChange({ count: summary.count, liked: summary.liked });
    });
  }
  function saveComment(c: ReviewComment) {
    run(async () => {
      mergeComment(
        await updateReviewComment(
          actionForm({ comment_id: c.id, body: editBody }),
        ),
      );
      setEditing(null);
    });
  }
  function removeComment(c: ReviewComment) {
    run(async () => {
      const result = await deleteReviewComment(
        actionForm({ comment_id: c.id }),
      );
      mergeComment(result.comment);
      publishChange({ commentCount: result.commentCount });
    });
  }
  function toggleCommentLike(c: ReviewComment) {
    run(async () => {
      const summary = await setReviewCommentLike(
        actionForm({ comment_id: c.id, liked: String(!c.liked) }),
      );
      setComments((previous) =>
        previous.map((item) =>
          item.id === c.id
            ? { ...item, likeCount: summary.count, liked: summary.liked }
            : item,
        ),
      );
    });
  }
  return {
    pathname,
    modal,
    modalOpen,
    setOpen,
    loaded,
    setModalExpanded,
    composer,
    liked,
    count,
    commentCount,
    toggleReviewLike,
    saveComment,
    removeComment,
    toggleCommentLike,
    submitComment,
    cancelAttempt,
    comments,
    next,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    mentionPrefix,
    commentBody,
    editing,
    setEditing,
    editBody,
    setEditBody,
    error,
    pending,
    expanded,
    run,
    load,
  };
}
