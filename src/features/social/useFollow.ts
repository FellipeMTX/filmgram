"use client";
import { useEffect, useState } from "react";
import { setReviewAuthorFollow } from "./review-follow-action";
export function useFollow(
  userId: string | null,
  authorId: string,
  followed: boolean,
) {
  const key = userId + ":" + authorId;
  const [following, setFollowing] = useState(followed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    // Server snapshots replace local state after navigation or refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowing(followed);
  }, [followed, key]);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; following: boolean }>)
        .detail;
      if (detail?.key === key) setFollowing(detail.following);
    };
    window.addEventListener("filmgram-follow-change", listener);
    return () => window.removeEventListener("filmgram-follow-change", listener);
  }, [key]);
  async function change(desired: boolean, beforePublish?: () => void) {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const actual = await setReviewAuthorFollow(authorId, desired);
      beforePublish?.();
      window.dispatchEvent(
        new CustomEvent("filmgram-follow-change", {
          detail: { key, following: actual },
        }),
      );
    } catch (cause) {
      setError(true);
      throw cause;
    } finally {
      setPending(false);
    }
  }
  return { following, pending, error, change };
}
