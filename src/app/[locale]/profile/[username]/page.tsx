import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signIn } from "@/features/auth/actions";
import { ProfileAccountMenu } from "@/features/profile/ProfileAccountMenu";
import { ProfileFollowButton } from "@/features/social/ProfileFollowButton";
import { getProfilePageData } from "@/features/profile/page-data";
import { profileLabels } from "@/features/profile/labels";
import { Posters, Lists, type Title } from "@/features/profile/ProfileMedia";
import { ProfileReviews } from "@/features/profile/ProfileReviews";
import { ProfileHabits } from "@/features/profile/ProfileHabits";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import { container, narrow, pageTitle } from "@/lib/layout";

const heading =
  "font-display text-[28px] leading-tight font-semibold text-heading";
const link =
  "font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<{
    tab?: string;
    type?: string;
    page?: string;
    period?: string;
  }>;
}) {
  const { locale, username } = await params;
  const q = await searchParams;
  const t = messages(locale);
  const l = profileLabels(locale);
  const user = await currentUser();
  const db = await supabase();
  if (username === "me" && !user)
    return (
      <main className={narrow}>
        <h1 className={pageTitle}>{t.profile}</h1>
        <p className="text-muted-foreground">{t.signInPrompt}</p>
        <form action={signIn}>
          <input
            type="hidden"
            name="next"
            value={"/" + locale + "/profile/me"}
          />
          <Button type="submit">{t.signIn}</Button>
        </form>
      </main>
    );
  if (!db) throw new Error("Database is not configured");
  const data = await getProfilePageData(db, user?.id, username, locale, q);
  if (!data) notFound();
  const {
    profile,
    own,
    period,
    tab,
    type,
    stats,
    followed,
    dashboard,
    history,
    liked,
    lists,
    reviewData,
    raw,
    page,
    pages,
  } = data;
  const tabs = [
    { id: "overview", label: l.overview },
    { id: "reviews", label: l.reviews },
    ...(own
      ? [
          { id: "watched", label: l.watched },
          { id: "liked", label: l.liked },
        ]
      : []),
    { id: "playlists", label: l.playlists },
  ];
  const base = "/" + locale + "/profile/" + encodeURIComponent(username);
  const href = (values: Record<string, string>) =>
    base + "?" + new URLSearchParams(values);
  const sectionTitle = (title: string, text?: string, url?: string) => (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className={heading}>{title}</h2>
      {text && url && (
        <Link href={url} className={link + " text-sm"}>
          {text}
        </Link>
      )}
    </div>
  );
  return (
    <main>
      <div className="relative isolate overflow-hidden bg-secondary">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--background)_0%,transparent_85%),linear-gradient(0deg,var(--background),transparent_70%),url(/profile-cinema.webp)] bg-cover bg-center" />
        <div
          className={
            container +
            " flex min-h-[290px] flex-wrap items-center gap-6 py-10 mobile:min-h-52 mobile:gap-4 mobile:py-7"
          }
        >
          <div className="grid size-36 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-avatar font-display text-5xl mobile:size-[72px] mobile:text-3xl">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              profile.display_name?.slice(0, 1)
            )}
          </div>
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <h1 className="m-0 font-display text-[44px] leading-tight font-bold mobile:text-3xl">
              {profile.display_name}
            </h1>
            <p className="mt-1 text-lg text-subtle mobile:text-sm">
              @{profile.handle}
            </p>
            <p className="mt-2 text-sm text-subtle">
              {stats?.follower_count || 0} {t.followers} ·{" "}
              {stats?.following_count || 0} {t.followingCount}
            </p>
            {user && !own && (
              <div className="mt-4">
                <ProfileFollowButton
                  userId={user.id}
                  authorId={profile.id}
                  followed={followed}
                  followLabel={t.follow}
                  unfollowLabel={t.unfollow}
                  locale={locale}
                />
              </div>
            )}
          </div>
          {own && (
            <div className="ml-auto shrink-0 max-[520px]:basis-full max-[520px]:text-right">
              <ProfileAccountMenu locale={locale} />
            </div>
          )}
        </div>
      </div>
      <div className={container + " pb-24"}>
        <nav
          aria-label={t.profile}
          className="flex justify-between gap-7 overflow-x-auto border-y border-border [scrollbar-width:none] mobile:gap-3.5 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={href({ tab: item.id })}
              aria-current={tab === item.id ? "page" : undefined}
              className={
                "shrink-0 border-b-[3px] px-1 py-3 font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ring mobile:px-0.5 mobile:text-sm " +
                (tab === item.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-subtle hover:text-foreground")
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {tab === "overview" ? (
          <>
            <div className="grid grid-cols-[3fr_2fr] gap-6 py-7 compact:grid-cols-1">
              <div className="min-w-0">
                {own && (
                  <section>
                    {sectionTitle(
                      l.recent,
                      own ? l.history : undefined,
                      href({ tab: "watched" }),
                    )}
                    {history.length ? (
                      <Posters items={history.slice(0, 4)} locale={locale} />
                    ) : (
                      <p className="text-subtle">{own ? l.emptyWatched : ""}</p>
                    )}
                  </section>
                )}
                <section className="mt-7 border-t border-border pt-4">
                  {sectionTitle(
                    l.recentReviews,
                    l.all,
                    href({ tab: "reviews" }),
                  )}
                  {reviewData.length ? (
                    <ProfileReviews items={reviewData} locale={locale} />
                  ) : (
                    <p className="text-subtle">{l.emptyReviews}</p>
                  )}
                </section>
              </div>
              <ProfileHabits
                locale={locale}
                own={own}
                period={period}
                dashboard={dashboard}
                stats={stats || null}
              />
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-6 compact:grid-cols-1">
              {own && (
                <section className="min-w-0">
                  {sectionTitle(l.liked, l.all, href({ tab: "liked" }))}
                  {liked.length ? (
                    <Posters items={liked.slice(0, 4)} locale={locale} liked />
                  ) : (
                    <p className="text-subtle">{l.emptyLiked}</p>
                  )}
                </section>
              )}
              <section
                className={
                  "min-w-0 " +
                  (own
                    ? "border-l border-border pl-6 compact:border-l-0 compact:border-t compact:pt-6 compact:pl-0"
                    : "")
                }
              >
                {sectionTitle(
                  l.playlists,
                  l.allLists,
                  href({ tab: "playlists" }),
                )}
                {lists.length ? (
                  <Lists lists={lists.slice(0, 2)} locale={locale} />
                ) : (
                  <p className="text-subtle">{l.emptyPlaylists}</p>
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="py-7">
            {sectionTitle(tabs.find((x) => x.id === tab)!.label)}
            {(tab === "watched" || tab === "liked") && (
              <nav aria-label={l.filter} className="mb-6 flex flex-wrap gap-2">
                {[
                  ["all", l.every],
                  ["movie", l.films],
                  ["tv", l.series],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    href={href({ tab, type: value || "all" })}
                    aria-current={type === value ? "page" : undefined}
                    className={
                      "rounded border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring " +
                      (type === value
                        ? "border-primary text-primary"
                        : "border-border")
                    }
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            {tab === "reviews" ? (
              reviewData.length ? (
                <ProfileReviews items={reviewData} locale={locale} />
              ) : (
                <p className="text-subtle">{l.emptyReviews}</p>
              )
            ) : tab === "playlists" ? (
              lists.length ? (
                <Lists lists={lists} locale={locale} />
              ) : (
                <p className="text-subtle">{l.emptyPlaylists}</p>
              )
            ) : raw.length ? (
              <Posters
                items={raw as Title[]}
                locale={locale}
                liked={tab === "liked"}
              />
            ) : (
              <p className="text-subtle">
                {tab === "watched" ? l.emptyWatched : l.emptyLiked}
              </p>
            )}
            {pages > 1 && (
              <nav
                aria-label={l.pagination}
                className="mt-8 flex items-center gap-5"
              >
                {page > 1 && (
                  <Link
                    className={link}
                    href={href({ tab, type, page: String(page - 1) })}
                  >
                    {l.previous}
                  </Link>
                )}
                <span>
                  {page} / {pages}
                </span>
                {page < pages && (
                  <Link
                    className={link}
                    href={href({ tab, type, page: String(page + 1) })}
                  >
                    {l.next}
                  </Link>
                )}
              </nav>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
