import Link from "next/link";
import Image from "next/image";
import { FilmgramRating } from "@/components/FilmgramRating";
import { titleReviewHref } from "@/features/catalog/movie-section-links";
import { imageUrl } from "@/integrations/tmdb-display";
import { profileLabels } from "./labels";
type Review = {
  id: string;
  mediaType: "movie" | "tv";
  tmdb_id: number;
  title: string;
  posterPath: string | null;
  created_at: string;
  rating: number;
  body: string | null;
};
export function ProfileReviews({
  items,
  locale,
}: {
  items: Review[];
  locale: string;
}) {
  const l = profileLabels(locale);
  return (
    <div>
      {items.map((r) => (
        <Link
          href={titleReviewHref(
            "/" + locale + "/title/" + r.mediaType + "/" + r.tmdb_id,
            r.id,
          )}
          key={r.id}
          className="flex gap-5 border-b border-border py-3 first:pt-0 last:border-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <div className="aspect-[2/3] w-[92px] shrink-0 overflow-hidden rounded-lg bg-secondary">
            {r.posterPath && (
              <Image
                src={imageUrl(r.posterPath, "w185")!}
                width={92}
                height={138}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-subtle">
                  {r.mediaType === "movie" ? l.film : l.seriesOne} ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(r.created_at))}
                </p>
              </div>
              <FilmgramRating value={r.rating} locale={locale} />
            </div>
            {r.body && <p className="mt-2 line-clamp-3 text-sm">{r.body}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
