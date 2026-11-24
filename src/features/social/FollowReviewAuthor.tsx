"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { setReviewAuthorFollow } from "./review-follow-action";

const followStates = new Map<string, boolean>();
export function FollowReviewAuthor({
  authorId,
  userId,
  followed,
  locale,
}: {
  authorId: string;
  userId: string | null;
  followed: boolean;
  locale: string;
}) {
  const key = `${userId}:${authorId}`;
  const [following, setFollowing] = useState(
    () => followStates.get(key) ?? followed,
  );
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; following: boolean }>)
        .detail;
      if (detail?.key === key) setFollowing(detail.following);
    };
    window.addEventListener("filmgram-follow-change", listener);
    return () => window.removeEventListener("filmgram-follow-change", listener);
  }, [key]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!userId || userId === authorId) return null;
  const label =
    locale === "pt-BR"
      ? following
        ? "Seguindo"
        : "Seguir"
      : locale === "es"
        ? following
          ? "Siguiendo"
          : "Seguir"
        : following
          ? "Following"
          : "Follow";
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-pressed={following}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            await setReviewAuthorFollow(authorId, !following);
            followStates.set(key, !following);
            window.dispatchEvent(
              new CustomEvent("filmgram-follow-change", {
                detail: { key, following: !following },
              }),
            );
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {locale === "pt-BR"
            ? "Tente novamente"
            : locale === "es"
              ? "Inténtalo de nuevo"
              : "Try again"}
        </span>
      )}
    </>
  );
}
