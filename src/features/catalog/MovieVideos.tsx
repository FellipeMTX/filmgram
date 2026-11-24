"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

type Video = {
  id: string;
  key: string;
  name: string;
  type: string;
  official: boolean;
  published_at: string | null;
};
const labels = {
  en: {
    play: "Play",
    watch: "Watch on YouTube",
    player: "Video player",
    official: "Official",
    select: "Choose a video",
  },
  "pt-BR": {
    play: "Reproduzir",
    watch: "Assistir no YouTube",
    player: "Reprodutor de vídeo",
    official: "Oficial",
    select: "Escolha um vídeo",
  },
  es: {
    play: "Reproducir",
    watch: "Ver en YouTube",
    player: "Reproductor de vídeo",
    official: "Oficial",
    select: "Elige un vídeo",
  },
};
export function MovieVideos({
  videos,
  locale,
}: {
  videos: Video[];
  locale: string;
}) {
  const [selected, setSelected] = useState(videos[0]?.id || "");
  const [playing, setPlaying] = useState(false);
  const l = labels[locale as keyof typeof labels] || labels.en;
  const video = videos.find((entry) => entry.id === selected);
  if (!video) return null;
  return (
    <div className="space-y-4">
      {videos.length > 1 && (
        <label className="block text-sm font-bold">
          {l.select}
          <NativeSelect
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setPlaying(false);
            }}
          >
            {videos.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <article className="min-w-0 rounded-lg border border-border bg-card p-4">
        <h3 className="font-bold break-words">{video.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {video.type}
          {video.official ? ` · ${l.official}` : ""}
        </p>
        {playing ? (
          <iframe
            ref={(node) => node?.focus()}
            className="mt-3 aspect-video w-full rounded-md bg-black"
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`}
            title={`${l.player}: ${video.name}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setPlaying(true)}
          >
            {l.play}: {video.name}
          </Button>
        )}
        <a
          className="mt-2 block text-sm text-primary hover:underline"
          href={`https://www.youtube.com/watch?v=${video.key}`}
          target="_blank"
          rel="noreferrer"
        >
          {l.watch} ↗
        </a>
      </article>
    </div>
  );
}
