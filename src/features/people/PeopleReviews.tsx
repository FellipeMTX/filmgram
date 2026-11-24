import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { signIn } from "@/features/auth/actions";
import { PersonReviewForm } from "@/features/people/PersonReviewForm";
import type { PersonWork } from "@/features/people/filmography";
import type { getPersonReviewData } from "@/features/people/review-queries";
import { titleName } from "@/integrations/tmdb-display";
import { messages } from "@/i18n/messages";
import { FilmgramRating } from "@/components/FilmgramRating";

type ReviewData = Awaited<ReturnType<typeof getPersonReviewData>>;
export function PeopleRating({
  data,
  locale,
}: {
  data: ReviewData;
  locale: string;
}) {
  const t = messages(locale);
  if (!data.available)
    return (
      <p className="text-sm text-muted-foreground">{t.reviewUnavailable}</p>
    );
  return (
    <p className="text-sm font-bold text-foreground">
      <span>{t.personReviews}: </span>
      {data.stats.averageRating == null ? (
        t.noPersonRatings
      ) : (
        <>
          <FilmgramRating value={data.stats.averageRating} locale={locale} /> ·{" "}
          {data.stats.count} {t.ratingCount}
        </>
      )}
    </p>
  );
}
export function PeopleReviews({
  data,
  locale,
  personId,
  userId,
  works,
  basePath,
}: {
  data: ReviewData;
  locale: string;
  personId: number;
  userId?: string;
  works: PersonWork[];
  basePath: string;
}) {
  const t = messages(locale);
  const lookup = new Map(
    works.map((work) => [`${work.media_type}:${work.id}`, work]),
  );
  const link = (page: number) =>
    `${basePath}${basePath.includes("?") ? "&" : "?"}reviewPage=${page}#person-reviews`;
  return (
    <section
      id="person-reviews"
      className="border-t border-border pt-9"
      aria-labelledby="person-reviews-heading"
    >
      <h2
        id="person-reviews-heading"
        className="mb-5 font-display text-[27px] font-semibold"
      >
        {t.personReviews}
      </h2>
      {!data.available ? (
        <p className="text-muted-foreground">{t.reviewUnavailable}</p>
      ) : (
        <div className="grid grid-cols-2 gap-[60px] mobile:grid-cols-1 mobile:gap-9">
          <section>
            <h3 className="mb-4 font-display text-[22px]">
              {t.addPersonReview}
            </h3>
            {userId ? (
              <PersonReviewForm
                key={personId}
                locale={locale}
                personId={personId}
                works={works}
                review={data.myReview}
              />
            ) : (
              <>
                <p className="mb-4 text-muted-foreground">
                  {t.personReviewPrompt}
                </p>
                <form action={signIn}>
                  <input
                    type="hidden"
                    name="next"
                    value={`${basePath}#person-reviews`}
                  />
                  <Button type="submit">{t.signIn}</Button>
                </form>
              </>
            )}
          </section>
          <section>
            <h3 className="mb-4 font-display text-[22px]">{t.reviewList}</h3>
            {data.reviews.length ? (
              data.reviews.map((review) => (
                <article
                  key={review.id}
                  className="mb-6 border-b border-border pb-5"
                >
                  {review.profile?.handle ? (
                    <Link
                      href={`/${locale}/profile/${encodeURIComponent(review.profile.handle)}`}
                    >
                      <strong>{review.profile.displayName || t.member}</strong>
                    </Link>
                  ) : (
                    <strong>{t.member}</strong>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <time dateTime={review.updatedAt}>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(review.updatedAt))}
                    </time>
                  </p>
                  <p className="mt-1">
                    <FilmgramRating value={review.rating} locale={locale} />
                  </p>
                  {review.body && (
                    <p className="mt-2 whitespace-pre-line break-words">
                      {review.body}
                    </p>
                  )}
                  {review.works.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                      {review.works.map((ref) => {
                        const work = lookup.get(
                          `${ref.mediaType}:${ref.tmdbId}`,
                        );
                        return (
                          <li key={`${ref.mediaType}:${ref.tmdbId}`}>
                            {work ? (
                              <Link
                                className="underline"
                                href={`/${locale}/title/${work.media_type}/${work.id}`}
                              >
                                {titleName(work)}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {t.unavailableReference} ({ref.mediaType}{" "}
                                {ref.tmdbId})
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              ))
            ) : (
              <p className="text-muted-foreground">{t.noPersonReviews}</p>
            )}
            {data.totalPages > 1 && (
              <nav
                aria-label={t.reviewList}
                className="flex flex-wrap items-center gap-3"
              >
                {data.page > 1 && (
                  <Link
                    href={link(data.page - 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {t.previousPage}
                  </Link>
                )}
                <span>
                  {t.page} {data.page} {t.of} {data.totalPages}
                </span>
                {data.page < data.totalPages && (
                  <Link
                    href={link(data.page + 1)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    {t.nextPage}
                  </Link>
                )}
              </nav>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
