"use client";

import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { messages } from "@/i18n/messages";
import { submitReviewFromModal } from "./actions";
import { signIn } from "@/features/auth/actions";
import { Dialog } from "radix-ui";
import { Pencil, Trash2 } from "lucide-react";
import { deleteOwnReview } from "./delete-own-review";
import type { loadTitleReviewContext } from "./title-review-context";

type Own = Awaited<ReturnType<typeof loadTitleReviewContext>>["own"];
export type EditorContext = {
  own: Own;
  editing: boolean;
  setEditing: (open: boolean) => void;
  locale: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
  userId: string | null;
  next: string;
  refresh: () => Promise<void>;
  onDeleted: (id: string) => Promise<void>;
};
export const CommunityEditorContext = createContext<EditorContext | null>(null);
export const useCommunityEditor = () => useContext(CommunityEditorContext);

export function CommunityEditControl({ reviewId }: { reviewId: string }) {
  const ctx = useCommunityEditor();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!ctx || ctx.own?.id !== reviewId) return null;
  const label =
    ctx.locale === "pt-BR"
      ? "Editar minha resenha"
      : ctx.locale === "es"
        ? "Editar mi reseña"
        : "Edit my review";
  const remove =
    ctx.locale === "pt-BR"
      ? "Excluir resenha"
      : ctx.locale === "es"
        ? "Eliminar reseña"
        : "Delete review";
  const confirm =
    ctx.locale === "pt-BR"
      ? "Excluir esta resenha?"
      : ctx.locale === "es"
        ? "¿Eliminar esta reseña?"
        : "Delete this review?";
  const cancel = ctx.locale === "en" ? "Cancel" : "Cancelar";
  const failed =
    ctx.locale === "pt-BR"
      ? "Não foi possível excluir. Tente novamente."
      : ctx.locale === "es"
        ? "No se pudo eliminar. Inténtalo de nuevo."
        : "Could not delete. Please try again.";
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={() => ctx.setEditing(true)}
      >
        <Pencil size={16} />
      </Button>
      <Dialog.Root
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) {
            setConfirming(open);
            setError(false);
          }
        }}
      >
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={remove}
          >
            <Trash2 size={16} />
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-[60] w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border border-border bg-card p-5 shadow-xl"
            aria-describedby={undefined}
          >
            <Dialog.Title className="text-lg font-bold">{confirm}</Dialog.Title>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {failed}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  {cancel}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError(false);
                  try {
                    await deleteOwnReview(reviewId);
                    await ctx.onDeleted(reviewId);
                    setConfirming(false);
                  } catch {
                    setError(true);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {remove}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export function CommunityCardEditor({ reviewId }: { reviewId: string }) {
  const ctx = useCommunityEditor();
  return ctx?.own?.id === reviewId ? <CommunityEditor /> : null;
}

export function CommunityEditor() {
  const ctx = useCommunityEditor();
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!ctx || !ctx.editing) return null;
  const { own, locale, mediaType, tmdbId, userId, next, refresh, setEditing } =
    ctx;
  const t = messages(locale);
  if (!userId)
    return (
      <form action={signIn}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline">
          {t.signInPrompt}
        </Button>
      </form>
    );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const form = new FormData(event.currentTarget);
        setSaving(true);
        setError(false);
        try {
          await submitReviewFromModal(form);
          await refresh();
          setEditing(false);
        } catch {
          setError(true);
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3 rounded-lg border border-primary/50 bg-background p-3"
    >
      <input type="hidden" name="media_type" value={mediaType} />
      <input type="hidden" name="tmdb_id" value={tmdbId} />
      <label className="block text-sm font-bold">
        {t.yourRating}
        <NativeSelect name="rating" required defaultValue={own?.rating || ""}>
          <option value="" disabled>
            ☆ ☆ ☆ ☆ ☆
          </option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n}/5)
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="block text-sm font-bold">
        {t.writeReview}
        <Textarea
          className="w-full"
          name="body"
          rows={4}
          defaultValue={own?.body || ""}
        />
      </label>
      <label className="block text-sm font-bold">
        {t.addVideo}
        <Input
          name="youtube"
          type="url"
          defaultValue={
            own?.youtube_video_id
              ? `https://www.youtube.com/watch?v=${own.youtube_video_id}`
              : ""
          }
        />
      </label>
      <Button type="submit" disabled={saving}>
        {t.publish}
      </Button>{" "}
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
        {locale === "en" ? "Cancel" : "Cancelar"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {locale === "pt-BR"
            ? "Não foi possível salvar. Tente novamente."
            : locale === "es"
              ? "No se pudo guardar. Inténtalo de nuevo."
              : "Could not save. Please try again."}
        </p>
      )}
    </form>
  );
}
