"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { imageUrl } from "@/integrations/tmdb-display";

type Video = {
  id: string;
  key: string;
  name: string;
  type: string;
  official: boolean;
  published_at: string | null;
  iso_639_1?: string | null;
};
const labels = {
  en: {
    play: "Play",
    watch: "Watch on YouTube",
    player: "Video player",
    official: "Official",
    select: "Choose a video",
    empty: "No videos available",
    types: {
      Trailer: "Trailer",
      Teaser: "Teaser",
      Clip: "Clip",
      Featurette: "Featurette",
      "Behind the Scenes": "Behind the scenes",
      Bloopers: "Bloopers",
      "Opening Credits": "Opening credits",
    },
  },
  "pt-BR": {
    play: "Reproduzir",
    watch: "Assistir no YouTube",
    player: "Reprodutor de vídeo",
    official: "Oficial",
    select: "Escolha um vídeo",
    empty: "Nenhum vídeo disponível",
    types: {
      Trailer: "Trailer",
      Teaser: "Teaser",
      Clip: "Cena",
      Featurette: "Especial",
      "Behind the Scenes": "Bastidores",
      Bloopers: "Erros de gravação",
      "Opening Credits": "Créditos de abertura",
    },
  },
  es: {
    play: "Reproducir",
    watch: "Ver en YouTube",
    player: "Reproductor de vídeo",
    official: "Oficial",
    select: "Elige un vídeo",
    empty: "No hay vídeos disponibles",
    types: {
      Trailer: "Tráiler",
      Teaser: "Avance",
      Clip: "Escena",
      Featurette: "Especial",
      "Behind the Scenes": "Detrás de cámaras",
      Bloopers: "Tomas falsas",
      "Opening Credits": "Créditos iniciales",
    },
  },
};
export function MovieVideos({
  videos,
  locale,
  backdropPath,
  unavailableMessage,
}: {
  videos: Video[];
  locale: string;
  backdropPath?: string | null;
  unavailableMessage?: string;
}) {
  const [selected, setSelected] = useState(videos[0]?.id || "");
  const [playing, setPlaying] = useState(false);
  const focusPlayer = useCallback((node: HTMLIFrameElement | null) => {
    node?.focus();
  }, []);
  const l = labels[locale as keyof typeof labels] || labels.en;
  const video = videos.find((entry) => entry.id === selected);
  const backdrop = imageUrl(backdropPath, "w780");
  const typeName = (type: string) =>
    l.types[type as keyof typeof l.types] || type;
  return (
    <div className="min-w-0 space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/50 bg-black">
        {playing && video ? (
          <iframe
            ref={focusPlayer}
            key={video.id}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`}
            title={`${l.player}: ${video.name}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            {backdrop && (
              <Image
                src={backdrop}
                alt=""
                fill
                sizes="(min-width: 801px) 45vw, 90vw"
                unoptimized
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            )}
            {video ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`${l.play}: ${video.name}`}
                className="absolute inset-0 grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
              >
                <span className="grid size-16 place-items-center rounded-full border border-white bg-black/50 text-white shadow-lg transition-colors hover:bg-black/80">
                  <Play aria-hidden="true" fill="currentColor" />
                </span>
              </button>
            ) : (
              <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white">
                {unavailableMessage || l.empty}
              </p>
            )}
          </>
        )}
      </div>
      {video && (
        <>
          {videos.length > 1 ? (
            <label className="grid items-center justify-center gap-x-3 gap-y-1.5 text-sm font-semibold sm:grid-cols-[auto_minmax(0,17rem)] [&_[data-slot=native-select-wrapper]]:w-full [&_[data-slot=native-select-wrapper]]:min-w-0">
              {l.select}
              <NativeSelect
                className="max-w-full truncate py-2 text-sm"
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setPlaying(false);
                }}
              >
                {videos.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {typeName(entry.type)}
                    {entry.official ? ` · ${l.official}` : ""} — {entry.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : (
            <p className="text-center text-sm font-semibold">
              {video.name} · {typeName(video.type)}
              {video.official ? ` · ${l.official}` : ""}
            </p>
          )}
          <a
            className="mx-auto block w-fit text-xs text-subtle hover:text-primary hover:underline"
            href={`https://www.youtube.com/watch?v=${video.key}`}
            target="_blank"
            rel="noreferrer"
          >
            {l.watch} ↗
          </a>
        </>
      )}
    </div>
  );
}
