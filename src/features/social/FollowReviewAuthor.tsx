"use client";
import { useEffect, useState } from "react";
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
  const [announced, setAnnounced] = useState(false);
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
      {!following && (
        <button
          type="button"
          className="ml-2 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          aria-disabled={pending}
          onClick={async (event) => {
            if (pending) return;
            const button = event.currentTarget;
            setPending(true);
            setError(false);
            try {
              await setReviewAuthorFollow(authorId, !following);
              if (document.activeElement === button) {
                const card = button.closest("article");
                const author = card?.querySelector<HTMLElement>(
                  'a[href*="/profile/"]',
                );
                if (author) author.focus();
                else if (card) {
                  card.tabIndex = -1;
                  card.focus();
                }
              }
              setAnnounced(true);
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
          + {label}
        </button>
      )}
      <span role="status" className="sr-only">
        {announced && following
          ? locale === "pt-BR"
            ? "Agora você segue este perfil."
            : locale === "es"
              ? "Ahora sigues este perfil."
              : "You now follow this profile."
          : ""}
      </span>
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
