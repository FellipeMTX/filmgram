import { imageUrl } from "@/integrations/tmdb-display";
import { cn } from "@/lib/utils";
import { Clapperboard } from "lucide-react";

export function PlaylistCover({
  posterPaths,
  className,
}: {
  posterPaths: (string | null)[];
  className?: string;
}) {
  const posters = posterPaths
    .filter((path): path is string => Boolean(path))
    .slice(0, 4);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid aspect-square grid-cols-2 grid-rows-2 overflow-hidden rounded-lg bg-secondary",
        className,
      )}
    >
      {Array.from({ length: 4 }, (_, index) =>
        posters[index] ? (
          // TMDB poster paths are supplied by the catalog.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={imageUrl(posters[index], "w342")}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            key={index}
            className="flex items-center justify-center border border-background/20 text-muted-foreground/40"
          >
            <Clapperboard className="size-7" />
          </div>
        ),
      )}
    </div>
  );
}
