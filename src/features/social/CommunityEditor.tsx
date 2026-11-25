"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RichReviewEditor } from "./RichReviewEditor";
import { parseReviewContent } from "./review-content";
import { FilmgramRatingPicker } from "@/components/FilmgramRating";
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
  editingTrigger: HTMLElement | null;
  setEditingTrigger: (trigger: HTMLElement | null) => void;
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
        onClick={(event) => ctx.setEditingTrigger(event.currentTarget)}
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
  const [document, setDocument] =
    useState<Parameters<typeof RichReviewEditor>[0]["document"]>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const initialDocument = useRef<string | null>(null);
  const documentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ctx?.editingTrigger) {
      initialDocument.current = null;
      documentRef.current = null;
      return;
    }
    const close = (event: Event) => {
      if (saving) {
        event.preventDefault();
        return;
      }
      const form = formRef.current;
      if (!form) return;
      const rating = new FormData(form).get("rating")?.toString() ?? "";
      const changed =
        rating !== (ctx.own?.rating == null ? "" : String(ctx.own.rating)) ||
        (initialDocument.current !== null &&
          documentRef.current !== initialDocument.current);
      const prompt =
        ctx.locale === "pt-BR"
          ? "Descartar alterações?"
          : ctx.locale === "es"
            ? "¿Descartar los cambios?"
            : "Discard changes?";
      if (changed && !window.confirm(prompt)) {
        event.preventDefault();
        return;
      }
      const trigger = ctx.editingTrigger;
      ctx.setEditingTrigger(null);
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    };
    const form = formRef.current;
    form?.addEventListener("filmgram-review-close", close);
    return () => form?.removeEventListener("filmgram-review-close", close);
  }, [ctx, saving]);
  if (!ctx || !ctx.editingTrigger) return null;
  const {
    own,
    locale,
    mediaType,
    tmdbId,
    userId,
    next,
    refresh,
    setEditingTrigger,
  } = ctx;
  const t = messages(locale);
  if (!userId)
    return (
      <form
        action={signIn}
        onSubmit={(event) => {
          if (!window.location.pathname.includes("/title/")) return;
          const input = event.currentTarget.elements.namedItem(
            "next",
          ) as HTMLInputElement | null;
          if (input)
            input.value =
              window.location.pathname +
              window.location.search +
              window.location.hash;
        }}
      >
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline">
          {t.signInPrompt}
        </Button>
      </form>
    );
  return (
    <form
      ref={formRef}
      data-review-editor
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.currentTarget.closest('[role="dialog"]')
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const form = event.currentTarget;
        form.dispatchEvent(
          new Event("filmgram-review-close", { cancelable: true }),
        );
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const form = new FormData(event.currentTarget);
        form.set("body_document", JSON.stringify(document));
        setSaving(true);
        setError(false);
        try {
          await submitReviewFromModal(form);
          await refresh();
          setEditingTrigger(null);
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
      <fieldset className="space-y-2 text-sm font-bold">
        <legend>{t.yourRating}</legend>
        <FilmgramRatingPicker
          defaultValue={own?.rating == null ? "" : String(own.rating)}
        />
      </fieldset>
      <div className="space-y-1">
        <p className="text-sm font-bold">{t.writeReview}</p>
        <RichReviewEditor
          locale={locale}
          body={own?.body || ""}
          document={parseReviewContent(own?.body_document)}
          video={own?.youtube_video_id || null}
          onChange={(value) => {
            const serialized = JSON.stringify(value);
            if (initialDocument.current === null) {
              initialDocument.current = serialized;
              requestAnimationFrame(() =>
                formRef.current
                  ?.querySelector<HTMLElement>('[role="textbox"]')
                  ?.focus(),
              );
            }
            documentRef.current = serialized;
            setDocument(value);
          }}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            const form = event.currentTarget.form;
            form?.dispatchEvent(
              new Event("filmgram-review-close", { cancelable: true }),
            );
          }}
          disabled={saving}
        >
          {locale === "en" ? "Cancel" : "Cancelar"}
        </Button>
        <Button type="submit" disabled={saving || !document}>
          {t.publish}
        </Button>
      </div>
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
