import { notFound } from "next/navigation";
import Link from "next/link";
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
      <main className="container narrow">
        <h1 className="pageTitle">{t.profile}</h1>
        <p className="muted">{t.signInPrompt}</p>
        <form action={signIn}>
          <input type="hidden" name="next" value={`/${locale}/profile/me`} />
          <button className="button primary">{t.signIn}</button>
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
    <main className="container narrow">
      <div className="profileHeader">
        <div className="avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            profile.display_name?.slice(0, 1)
          )}
        </div>
        <div>
          <h1 className="pageTitle">{profile.display_name}</h1>
          <p className="muted">@{profile.handle}</p>
          <p>
            {stats?.follower_count || 0} {t.followers} &nbsp; · &nbsp;{" "}
            {stats?.following_count || 0} {t.followingCount}
          </p>
        </div>
        {user && user.id !== profile.id && (
          <form action={toggleFollow}>
            <input type="hidden" name="following_id" value={profile.id} />
            <button className="button primary">
              {follow ? t.unfollow : t.follow}
            </button>
          </form>
        )}
        {user?.id === profile.id && (
          <form action={signOut}>
            <input type="hidden" name="next" value={`/${locale}/discover`} />
            <button className="button">{t.signOut}</button>
          </form>
        )}
      </div>
      <section className="panel">
        <h2>{t.viewingHabits}</h2>
        <div className="stats">
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
          <div className="genreRow" key={id}>
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
      {user?.id === profile.id && (
        <section className="panel">
          <h2>{t.favorites}</h2>
          <Link className="button" href={`/${locale}/favorites`}>
            {t.viewFavorites}
          </Link>
        </section>
      )}
      <section className="panel">
        <h2>{t.playlists}</h2>
        {playlists?.length ? (
          playlists.map((p) => (
            <p key={p.id}>
              <Link href={`/${locale}/playlists/${p.id}`}>{p.name} ↗</Link>
            </p>
          ))
        ) : (
          <p className="muted">{t.noPlaylists}</p>
        )}
      </section>
      <section className="panel">
        <h2>{t.reviews}</h2>
        {reviews?.length ? (
          reviews.map((r) => (
            <p key={r.id}>
              <Link href={`/${locale}/title/${r.media_type}/${r.tmdb_id}`}>
                <span className="stars">{"★".repeat(r.rating)}</span> &nbsp;{" "}
                {r.body || t.viewDetails} ↗
              </Link>
            </p>
          ))
        ) : (
          <p className="muted">{t.noReviews}</p>
        )}
      </section>
    </main>
  );
}
