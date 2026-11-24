"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/features/catalog/MediaImage";
import { updatePlaylistDetail } from "./playlist-detail-actions";
import { messages } from "@/i18n/messages";
import { imageUrl } from "@/integrations/tmdb-display";

type Item = {
  id: string;
  media_type: string;
  tmdb_id: number;
  media_title: string;
  poster_path: string | null;
};

export function PlaylistItems({
  locale,
  playlistId,
  items,
  owner,
}: {
  locale: string;
  playlistId: string;
  items: Item[];
  owner: boolean;
}) {
  const [state, action, pending] = useActionState(updatePlaylistDetail, {});
  const [dismissed, setDismissed] = useState(false);
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
  const list = (
    <ol className="mt-4">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-4 border-b border-border py-3"
        >
          <span className="w-7 text-center text-muted-foreground">
            {index + 1}
          </span>
          <Link
            href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}
            className="flex min-w-0 flex-1 items-center gap-4 font-semibold hover:text-primary"
          >
            <span className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-center text-xs text-muted-foreground [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              <MediaImage
                src={imageUrl(item.poster_path, "w185")}
                alt=""
                fallback={t.noPoster}
              />
            </span>
            <span className="min-w-0 break-words">{item.media_title}</span>
          </Link>
          {owner && (
            <div className="flex items-center gap-1">
              <Button
                type="submit"
                name="operation"
                value={`up:${item.id}`}
                variant="ghost"
                size="icon"
                disabled={pending || index === 0}
                aria-label={`${t.moveUp}: ${item.media_title}`}
              >
                ↑
              </Button>
              <Button
                type="submit"
                name="operation"
                value={`down:${item.id}`}
                variant="ghost"
                size="icon"
                disabled={pending || index === items.length - 1}
                aria-label={`${t.moveDown}: ${item.media_title}`}
              >
                ↓
              </Button>
              <Button
                type="submit"
                name="operation"
                value={`remove:${item.id}`}
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`${t.remove}: ${item.media_title}`}
              >
                ×
              </Button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
  if (!owner) return list;
  return (
    <form action={action} onSubmit={() => setDismissed(false)}>
      <input type="hidden" name="playlist_id" value={playlistId} />
      <input
        type="hidden"
        name="expected_ids"
        value={items.map((item) => item.id).join(",")}
      />
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {copy.pending}
        </p>
      )}
      {state.error && !dismissed && (
        <p role="alert" className="text-sm text-destructive">
          {copy[state.error]}{" "}
          {state.error === "conflict" && (
            <button
              type="button"
              className="underline"
              onClick={() => {
                setDismissed(true);
                router.refresh();
              }}
            >
              {copy.refresh}
            </button>
          )}
        </p>
      )}
      {list}
    </form>
  );
}
