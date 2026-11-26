"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaType } from "@/integrations/tmdb";
import { recordRewatch } from "@/features/library/watch-actions";

const labels = {
  "pt-BR": {
    action: "Registrar nova exibição",
    pending: "Registrando…",
    success: "Nova exibição registrada.",
    error: "Não foi possível registrar a exibição. Tente novamente.",
  },
  en: {
    action: "Log another viewing",
    pending: "Logging…",
    success: "New viewing logged.",
    error: "Could not log the viewing. Try again.",
  },
  es: {
    action: "Registrar otro visionado",
    pending: "Registrando…",
    success: "Nuevo visionado registrado.",
    error: "No se pudo registrar el visionado. Vuelve a intentarlo.",
  },
};

export function RecordRewatchButton({
  mediaType,
  tmdbId,
  locale,
}: {
  mediaType: MediaType;
  tmdbId: number;
  locale: string;
}) {
  const text = labels[locale as keyof typeof labels] ?? labels.en;
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    form.set("request_id", requestId.current);
    sending.current = true;
    setStatus(null);
    startTransition(async () => {
      try {
        await recordRewatch(form);
        requestId.current = null;
        setStatus("success");
      } catch {
        setStatus("error");
      } finally {
        sending.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="min-w-0" aria-busy={pending}>
      <input type="hidden" name="media_type" value={mediaType} />
      <input type="hidden" name="tmdb_id" value={tmdbId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        <RotateCcw aria-hidden="true" />
        {pending ? text.pending : text.action}
      </Button>
      {status === "success" && (
        <p role="status" className="mt-1 text-xs text-subtle">
          {text.success}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-1 max-w-56 text-xs text-destructive">
          {text.error}
        </p>
      )}
    </form>
  );
}
