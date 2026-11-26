import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { PlaylistCover } from "@/components/playlist-cover";
import { imageUrl } from "@/integrations/tmdb-display";
import { profileLabels } from "./labels";
import type {
  ProfileHistoryItem,
  ProfilePlaylist,
  ProfileTitle,
} from "./types";

export function Posters({
  items,
  locale,
  liked = false,
}: {
  items: (ProfileTitle & Partial<Pick<ProfileHistoryItem, "lastWatchedAt">>)[];
  locale: string;
  liked?: boolean;
}) {
  const l = profileLabels(locale);
  return (
    <div className="grid grid-cols-4 gap-3 mobile:grid-cols-2">
      {items.map((item) => (
        <Link
          className="group min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          key={item.mediaType + "-" + item.tmdbId}
          href={"/" + locale + "/title/" + item.mediaType + "/" + item.tmdbId}
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-secondary">
            {item.posterPath && (
              <Image
                src={imageUrl(item.posterPath, "w342")!}
                fill
                sizes="(max-width: 700px) 45vw, 20vw"
                alt=""
                className="h-full w-full object-cover"
              />
            )}
            {liked && (
              <span className="absolute right-2 bottom-2 rounded-full bg-background/90 p-1.5 text-primary">
                <Heart className="size-5 fill-current" aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="mt-2 truncate font-semibold group-hover:underline">
            {item.title}
          </p>
          {item.lastWatchedAt && (
            <p className="text-xs text-subtle">
              {item.mediaType === "movie" ? l.film : l.seriesOne} ·{" "}
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(item.lastWatchedAt),
              )}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
export function Lists({
  lists,
  locale,
}: {
  lists: ProfilePlaylist[];
  locale: string;
}) {
  const l = profileLabels(locale);
  return (
    <div className="grid grid-cols-2 gap-4">
      {lists.map((p) => (
        <Link
          key={p.id}
          href={"/" + locale + "/playlists/" + p.id}
          className="group min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <PlaylistCover
            posterPaths={p.posterPaths}
            className="aspect-[5/3] w-full border border-border"
          />
          <p className="mt-2 truncate font-semibold group-hover:underline">
            {p.name}
          </p>
          <p className="text-sm text-subtle">
            {p.itemCount} {l.titles}
            {!p.isPublic && " - " + l.private}
          </p>
        </Link>
      ))}
    </div>
  );
}
