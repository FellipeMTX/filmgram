"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const labels = {
  en: {
    play: "Play YouTube video",
    open: "Watch on YouTube",
    player: "YouTube video player",
  },
  "pt-BR": {
    play: "Reproduzir vídeo do YouTube",
    open: "Assistir no YouTube",
    player: "Reprodutor de vídeo do YouTube",
  },
  es: {
    play: "Reproducir vídeo de YouTube",
    open: "Ver en YouTube",
    player: "Reproductor de vídeo de YouTube",
  },
};

function videoId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : host === "youtube.com" || host === "m.youtube.com"
          ? url.searchParams.get("v")
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function ReviewVideo({ url, locale }: { url: string; locale: string }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const id = videoId(url);
  const playing = id !== null && playingId === id;
  const player = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (playing) player.current?.focus();
  }, [playing]);
  const l = labels[locale as keyof typeof labels] || labels.en;
  if (!id) return null;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  return (
    <div className="mt-3 space-y-2">
      {playing ? (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            ref={player}
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={l.player}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setPlayingId(id)}
        >
          ▶ {l.play}
        </Button>
      )}
      <a
        href={watch}
        target="_blank"
        rel="noreferrer"
        className="block text-sm text-primary hover:underline"
      >
        {l.open} ↗
      </a>
    </div>
  );
}
