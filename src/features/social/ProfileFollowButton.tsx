"use client";
import { Button } from "@/components/ui/button";
import { useFollow } from "./useFollow";
import { setProfileAuthorFollow } from "./review-follow-action";
export function ProfileFollowButton({
  userId,
  authorId,
  followed,
  followLabel,
  unfollowLabel,
  locale,
}: {
  userId: string;
  authorId: string;
  followed: boolean;
  followLabel: string;
  unfollowLabel: string;
  locale: string;
}) {
  const { following, pending, error, change } = useFollow(
    userId,
    authorId,
    followed,
  );
  return (
    <form
      action={setProfileAuthorFollow.bind(null, authorId, !following)}
      onSubmit={(event) => {
        event.preventDefault();
        void change(!following).catch(() => {});
      }}
    >
      <Button type="submit" variant="outline" disabled={pending}>
        {following ? unfollowLabel : followLabel}
      </Button>
      {error && (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {locale === "pt-BR"
            ? "Tente novamente"
            : locale === "es"
              ? "Int\u00e9ntalo de nuevo"
              : "Try again"}
        </span>
      )}
    </form>
  );
}
