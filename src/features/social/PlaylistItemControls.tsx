"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updatePlaylistDetail } from "./playlist-detail-actions";
import { messages } from "@/i18n/messages";

export function PlaylistItemControls({
  locale,
  playlistId,
  itemId,
  title,
  ids,
  index,
}: {
  locale: string;
  playlistId: string;
  itemId: string;
  title: string;
  ids: string[];
  index: number;
}) {
  const [state, action, pending] = useActionState(updatePlaylistDetail, {});
  const router = useRouter();
  const t = messages(locale);
  const copy =
    locale === "pt-BR"
      ? {
          conflict: "A ordem da playlist mudou. Atualize e tente novamente.",
          failed: "Não foi possível atualizar a playlist.",
          refresh: "Atualizar",
          pending: "Salvando…",
        }
      : locale === "es"
        ? {
            conflict:
              "El orden de la lista cambió. Actualiza e inténtalo de nuevo.",
            failed: "No se pudo actualizar la lista.",
            refresh: "Actualizar",
            pending: "Guardando…",
          }
        : {
            conflict: "The playlist order changed. Refresh and try again.",
            failed: "Could not update the playlist.",
            refresh: "Refresh",
            pending: "Saving…",
          };
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-1">
        <input type="hidden" name="playlist_id" value={playlistId} />
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="expected_ids" value={ids.join(",")} />
        <Button
          type="submit"
          name="operation"
          value="up"
          variant="ghost"
          size="icon"
          disabled={pending || index === 0}
          aria-label={`${t.moveUp}: ${title}`}
        >
          ↑
        </Button>
        <Button
          type="submit"
          name="operation"
          value="down"
          variant="ghost"
          size="icon"
          disabled={pending || index === ids.length - 1}
          aria-label={`${t.moveDown}: ${title}`}
        >
          ↓
        </Button>
        <Button
          type="submit"
          name="operation"
          value="remove"
          variant="ghost"
          size="icon"
          disabled={pending}
          aria-label={`${t.remove}: ${title}`}
        >
          ×
        </Button>
        {pending && (
          <span role="status" className="text-sm text-muted-foreground">
            {copy.pending}
          </span>
        )}
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {copy[state.error]}{" "}
          {state.error === "conflict" && (
            <button
              type="button"
              className="underline"
              onClick={() => router.refresh()}
            >
              {copy.refresh}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
