import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewComment } from "./review-discussion-queries";
import type { labels } from "./discussion-labels";
import type { useReviewDiscussion } from "./useReviewDiscussion";
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

export function DiscussionComments({
  discussion,
  locale,
  userId,
  l,
}: {
  discussion: Pick<
    ReturnType<typeof useReviewDiscussion>,
    | "composer"
    | "saveComment"
    | "removeComment"
    | "toggleCommentLike"
    | "draft"
    | "setDraft"
    | "replyTo"
    | "setReplyTo"
    | "editing"
    | "setEditing"
    | "editBody"
    | "setEditBody"
    | "pending"
    | "comments"
  >;
  locale: string;
  userId: string | null;
  l: typeof labels.en;
}) {
  const {
    composer,
    saveComment,
    removeComment,
    toggleCommentLike,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    editBody,
    setEditBody,
    pending,
  } = discussion;
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
                  onClick={() => saveComment(c)}
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
                      onClick={() => removeComment(c)}
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
            onClick={() => toggleCommentLike(c)}
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
  return <>{discussion.comments.map((c) => comment(c))}</>;
}
