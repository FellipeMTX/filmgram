import { signIn } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { labels } from "./discussion-labels";
import type { useReviewDiscussion } from "./useReviewDiscussion";
export function DiscussionComposer({
  discussion,
  reviewId,
  userId,
  l,
}: {
  discussion: Pick<
    ReturnType<typeof useReviewDiscussion>,
    | "pathname"
    | "composer"
    | "submitComment"
    | "cancelAttempt"
    | "draft"
    | "setDraft"
    | "replyTo"
    | "setReplyTo"
    | "mentionPrefix"
    | "commentBody"
    | "pending"
  >;
  reviewId: string;
  userId: string | null;
  l: typeof labels.en;
}) {
  const {
    pathname,
    composer,
    submitComment,
    cancelAttempt,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    mentionPrefix,
    commentBody,
    pending,
  } = discussion;
  const nextPath = pathname;
  return userId ? (
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
        aria-describedby={replyTo ? `reply-target-${reviewId}` : undefined}
        placeholder={l.placeholder}
        value={draft}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (replyTo && !value.startsWith(mentionPrefix)) setReplyTo(null);
        }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending || (!replyTo && !draft)}
          onClick={() => {
            cancelAttempt();
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
          onClick={submitComment}
        >
          {pending ? l.sending : l.submit}
        </Button>
      </div>
    </div>
  ) : (
    <form
      action={signIn}
      onSubmit={(event) => {
        const url = new URL(window.location.href);
        if (pathname.includes("/title/"))
          url.searchParams.set("review", reviewId);
        const input = event.currentTarget.elements.namedItem(
          "next",
        ) as HTMLInputElement | null;
        if (input)
          input.value = url.pathname + url.search + `#review-${reviewId}`;
      }}
    >
      <input
        type="hidden"
        name="next"
        value={`${nextPath}#review-${reviewId}`}
      />
      <Button type="submit" size="sm" variant="outline">
        {l.login}
      </Button>
    </form>
  );
}
