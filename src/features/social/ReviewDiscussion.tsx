"use client";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labels } from "./discussion-labels";
import { DiscussionComments } from "./DiscussionComments";
import { DiscussionComposer } from "./DiscussionComposer";
import { useReviewDiscussion } from "./useReviewDiscussion";
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
  const discussion = useReviewDiscussion({
    reviewId,
    initialCount,
    initialCommentCount,
    initialLiked,
  });
  const {
    modal,
    modalOpen,
    setOpen,
    loaded,
    setModalExpanded,
    liked,
    count,
    commentCount,
    next,
    pending,
    expanded,
    run,
    load,
    toggleReviewLike,
    error,
  } = discussion;
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
          onClick={toggleReviewLike}
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
          <DiscussionComments
            discussion={discussion}
            locale={locale}
            userId={userId}
            l={l}
          />
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
          <DiscussionComposer
            discussion={discussion}
            reviewId={reviewId}
            userId={userId}
            l={l}
          />
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
