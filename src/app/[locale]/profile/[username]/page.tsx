import { Card } from "@/components/ui/card";
import { narrow, pageTitle } from "@/lib/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FilmgramRating } from "@/components/FilmgramRating";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { signIn, signOut } from "@/features/auth/actions";
import { toggleFollow } from "@/features/social/actions";
export default async function Profile({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params,
    t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  if (username === "me" && !user)
    return (
      <main className={narrow}>
        <h1 className={pageTitle}>{t.profile}</h1>
        <p className="text-muted-foreground">{t.signInPrompt}</p>
        <form action={signIn}>
          <input type="hidden" name="next" value={`/${locale}/profile/me`} />
          <Button type="submit">{t.signIn}</Button>
        </form>
      </main>
    );
  if (!db) notFound();
  let query = db.from("profiles").select("id,handle,display_name,avatar_url");
  query =
    username === "me" ? query.eq("id", user!.id) : query.eq("handle", username);
  const { data: profile } = await query.maybeSingle();
  if (!profile) notFound();
  const [
    { data: statsData },
    { data: follow },
    { data: playlists },
    { data: reviews },
  ] = await Promise.all([
    db.rpc("profile_stats", { p_profile_id: profile.id }),
    user
      ? db
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("playlists").select("id,name,is_public").eq("user_id", profile.id),
    db
      .from("reviews")
      .select("id,media_type,tmdb_id,rating,body")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);
  const stats = Array.isArray(statsData) ? statsData[0] : statsData;
  const genreLabels: Record<number, [string, string, string]> = {
    28: ["Action", "Ação", "Acción"],
    12: ["Adventure", "Aventura", "Aventura"],
    16: ["Animation", "Animação", "Animación"],
    35: ["Comedy", "Comédia", "Comedia"],
    80: ["Crime", "Crime", "Crimen"],
    99: ["Documentary", "Documentário", "Documental"],
    18: ["Drama", "Drama", "Drama"],
    10751: ["Family", "Família", "Familia"],
    14: ["Fantasy", "Fantasia", "Fantasía"],
    27: ["Horror", "Terror", "Terror"],
    9648: ["Mystery", "Mistério", "Misterio"],
    10749: ["Romance", "Romance", "Romance"],
    878: ["Science Fiction", "Ficção científica", "Ciencia ficción"],
    53: ["Thriller", "Suspense", "Suspenso"],
    10759: ["Action & Adventure", "Ação e aventura", "Acción y aventura"],
    10765: [
      "Sci-Fi & Fantasy",
      "Ficção científica e fantasia",
      "Ciencia ficción y fantasía",
    ],
  };
  const lang = locale === "pt-BR" ? 1 : locale === "es" ? 2 : 0;
  const topGenres = Object.entries(
    (stats?.genre_counts || {}) as Record<string, number>,
  )
    .map(([id, count]) => [Number(id), Number(count)] as [number, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <main className={narrow}>
      <div className="mb-[30px] flex items-center gap-6 mobile:flex-wrap [&_form]:ml-auto mobile:[&_form]:ml-0 [&_h1]:m-0">
        <div className="grid h-[95px] w-[95px] place-items-center overflow-hidden rounded-full bg-avatar font-display text-[36px] font-bold mobile:h-[70px] mobile:w-[70px] [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            profile.display_name?.slice(0, 1)
          )}
        </div>
        <div>
          <h1 className={pageTitle}>{profile.display_name}</h1>
          <p className="text-muted-foreground">@{profile.handle}</p>
          <p>
            {stats?.follower_count || 0} {t.followers} &nbsp; · &nbsp;{" "}
            {stats?.following_count || 0} {t.followingCount}
          </p>
        </div>
        {user && user.id !== profile.id && (
          <form action={toggleFollow}>
            <input type="hidden" name="following_id" value={profile.id} />
            <Button type="submit">{follow ? t.unfollow : t.follow}</Button>
          </form>
        )}
        {user?.id === profile.id && (
          <form action={signOut}>
            <input type="hidden" name="next" value={`/${locale}/discover`} />
            <Button type="submit" variant="outline">
              {t.signOut}
            </Button>
          </form>
        )}
      </div>
      <Card asChild>
        <section className="[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold">
          <h2>{t.viewingHabits}</h2>
          <div className="flex gap-[15px] [&_div]:flex [&_div]:min-w-[120px] [&_div]:flex-col [&_div]:border [&_div]:border-stats-border [&_div]:p-[15px] [&_div]:text-center [&_strong]:text-[25px]">
            <div>
              <strong>{stats?.movie_count || 0}</strong>
              {t.films}
            </div>
            <div>
              <strong>{stats?.series_count || 0}</strong>
              {t.series}
            </div>
          </div>
          {topGenres.map(([id, count]) => (
            <div
              className="mt-4 grid grid-cols-[140px_1fr_25px] items-center gap-2.5 text-[13px] [&_div]:h-2 [&_div]:overflow-hidden [&_div]:rounded-[5px] [&_div]:bg-muted [&_i]:block [&_i]:h-full [&_i]:rounded-[5px] [&_i]:bg-primary"
              key={id}
            >
              <span>{genreLabels[id]?.[lang] || `#${id}`}</span>
              <div>
                <i
                  style={{
                    width: `${Math.round((count / Math.max((stats?.movie_count || 0) + (stats?.series_count || 0), 1)) * 100)}%`,
                  }}
                />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </section>
      </Card>
      {user?.id === profile.id && (
        <Card asChild>
          <section className="[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold">
            <h2>{t.favorites}</h2>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/${locale}/favorites`}
            >
              {t.viewFavorites}
            </Link>
          </section>
        </Card>
      )}
      <Card asChild>
        <section className="[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold">
          <h2>{t.playlists}</h2>
          {playlists?.length ? (
            playlists.map((p) => (
              <p key={p.id}>
                <Link href={`/${locale}/playlists/${p.id}`}>{p.name} ↗</Link>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">{t.noPlaylists}</p>
          )}
        </section>
      </Card>
      <Card asChild>
        <section className="[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold">
          <h2>{t.reviews}</h2>
          {reviews?.length ? (
            reviews.map((r) => (
              <p key={r.id}>
                <Link href={`/${locale}/title/${r.media_type}/${r.tmdb_id}`}>
                  <FilmgramRating value={r.rating} locale={locale} /> &nbsp;{" "}
                  {r.body || t.viewDetails} ↗
                </Link>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">{t.noReviews}</p>
          )}
        </section>
      </Card>
    </main>
  );
}
