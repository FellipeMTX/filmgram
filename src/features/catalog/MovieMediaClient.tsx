"use client";

import { Suspense, use, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { MovieImage, MovieVideo } from "@/integrations/tmdb";
import { imageUrl } from "@/integrations/tmdb-display";

const labels = {
  en: {
    play: "Play",
    player: "Video player",
    close: "Close",
    image: "View image",
    previous: "Previous image",
    next: "Next image",
    more: "Show more",
  },
  "pt-BR": {
    play: "Reproduzir",
    player: "Reprodutor de vídeo",
    close: "Fechar",
    image: "Ver imagem",
    previous: "Imagem anterior",
    next: "Próxima imagem",
    more: "Mostrar mais",
  },
  es: {
    play: "Reproducir",
    player: "Reproductor de vídeo",
    close: "Cerrar",
    image: "Ver imagen",
    previous: "Imagen anterior",
    next: "Imagen siguiente",
    more: "Mostrar más",
  },
};

function VideoArtwork({ path }: { path?: string | null }) {
  const src = imageUrl(path, "w780");
  return src ? (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 900px) 40vw, 90vw"
      unoptimized
      className="object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none"
    />
  ) : null;
}

function TrailerArtwork({
  artwork,
  index,
  backdrop,
}: {
  artwork: Promise<string[]>;
  index: number;
  backdrop?: string | null;
}) {
  const images = use(artwork);
  return <VideoArtwork path={images[index] ?? backdrop} />;
}

export function VideoCards({
  locale,
  videos,
  backdrop,
  artwork,
  hero = false,
}: {
  locale: string;
  videos: MovieVideo[];
  backdrop?: string | null;
  artwork?: Promise<string[]>;
  hero?: boolean;
}) {
  const [selected, setSelected] = useState<MovieVideo | null>(null);
  const [limit, setLimit] = useState(24);
  const opener = useRef<HTMLButtonElement | null>(null);
  const t = labels[locale as keyof typeof labels] || labels.en;
  return (
    <Dialog.Root
      open={!!selected}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    >
      <div
        className={
          hero
            ? "grid h-full min-h-0 gap-3"
            : "grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-3"
        }
        style={
          hero && videos.length > 1
            ? { gridTemplateRows: `repeat(${videos.length}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {videos.slice(0, limit).map((video, index) => (
          <Dialog.Trigger asChild key={video.id}>
            <button
              type="button"
              onClick={(event) => {
                opener.current = event.currentTarget;
                setSelected(video);
              }}
              aria-label={`${t.play}: ${video.name}`}
              className={`group relative w-full overflow-hidden rounded-xl border border-border bg-surface text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${hero && videos.length > 1 ? "min-h-28" : "aspect-video"}`}
            >
              {artwork ? (
                <Suspense fallback={<VideoArtwork path={backdrop} />}>
                  <TrailerArtwork
                    artwork={artwork}
                    index={index}
                    backdrop={backdrop}
                  />
                </Suspense>
              ) : (
                <VideoArtwork path={backdrop} />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/20" />
              <span
                className={
                  hero && videos.length > 1
                    ? "absolute right-3 top-3"
                    : "absolute inset-0 grid place-items-center"
                }
              >
                <span className="grid size-12 place-items-center rounded-full border border-white bg-black/50 text-white">
                  <Play
                    aria-hidden="true"
                    fill="currentColor"
                    className="size-5"
                  />
                </span>
              </span>
              <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold text-white">
                {video.name}
              </span>
            </button>
          </Dialog.Trigger>
        ))}
      </div>
      {videos.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + 24)}
          className="mt-3 text-sm text-primary hover:underline"
        >
          {t.more}
        </button>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 w-[min(94vw,960px,calc(177.78dvh-7.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black p-2 shadow-xl focus:outline-none"
        >
          <Dialog.Title className="sr-only">
            {t.player}: {selected?.name}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {selected?.name}
          </Dialog.Description>
          <Dialog.Close
            aria-label={t.close}
            className="mb-1 ml-auto grid size-9 place-items-center rounded text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2"
          >
            <X />
          </Dialog.Close>
          {selected && (
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${selected.key}?autoplay=1`}
              title={`${t.player}: ${selected.name}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ImageGrid({
  locale,
  images,
  name,
  poster,
}: {
  locale: string;
  images: MovieImage[];
  name: string;
  poster: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [limit, setLimit] = useState(24);
  const opener = useRef<HTMLButtonElement | null>(null);
  const t = labels[locale as keyof typeof labels] || labels.en;
  const current = index === null ? null : images[index];
  const move = (delta: number) =>
    setIndex((value) =>
      value === null ? null : (value + delta + images.length) % images.length,
    );
  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={(open) => {
        if (!open) setIndex(null);
      }}
    >
      <div
        className={`grid gap-3 ${poster ? "grid-cols-2 sm:grid-cols-4 min-[900px]:grid-cols-6" : "grid-cols-2 min-[900px]:grid-cols-3"}`}
      >
        {images.slice(0, limit).map((image, i) => (
          <Dialog.Trigger asChild key={image.file_path}>
            <button
              type="button"
              onClick={(event) => {
                opener.current = event.currentTarget;
                setIndex(i);
              }}
              aria-label={`${t.image}: ${name} ${i + 1}`}
              className={`relative overflow-hidden rounded-lg bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${poster ? "aspect-[2/3]" : "aspect-video"}`}
            >
              <Image
                src={imageUrl(image.file_path, "w500")!}
                alt=""
                fill
                sizes="(min-width: 900px) 20vw, 45vw"
                unoptimized
                className="object-cover"
              />
            </button>
          </Dialog.Trigger>
        ))}
      </div>
      {images.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + 24)}
          className="mt-3 text-sm text-primary hover:underline"
        >
          {t.more}
        </button>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") move(-1);
            if (event.key === "ArrowRight") move(1);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-12 focus:outline-none"
        >
          <Dialog.Title className="sr-only">
            {t.image}: {name}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {index === null ? "" : `${index + 1} / ${images.length}`}
          </Dialog.Description>
          <Dialog.Close
            aria-label={t.close}
            className="absolute top-4 right-4 rounded p-2 text-white focus-visible:outline"
          >
            <X />
          </Dialog.Close>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label={t.previous}
                className="absolute left-2 rounded p-2 text-white focus-visible:outline"
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label={t.next}
                className="absolute right-2 rounded p-2 text-white focus-visible:outline"
              >
                <ChevronRight />
              </button>
            </>
          )}
          {current && (
            <Image
              src={imageUrl(current.file_path, "original")!}
              alt={`${name} ${index! + 1}`}
              width={current.width}
              height={current.height}
              unoptimized
              className="max-h-full max-w-full object-contain"
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
