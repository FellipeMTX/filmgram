"use client";
import { useState } from "react";
import { useFollow } from "./useFollow";

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
  const { following, pending, error, change } = useFollow(
    userId,
    authorId,
    followed,
  );
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
            const restoreFocus = document.activeElement === button;
            try {
              // A server refresh can unmount a card from a later page while
              // its discussion is open. The list refreshes after the dialog closes.
              await change(
                true,
                () => {
                  if (
                    restoreFocus &&
                    (document.activeElement === button ||
                      document.activeElement === document.body)
                  ) {
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
                },
                !button.closest('[role="dialog"]'),
              );
              setAnnounced(true);
            } catch {
              // Error is displayed below.
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
