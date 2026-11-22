import { notFound } from "next/navigation";
import {
  getDetail,
  imageUrl,
  titleName,
  year,
  type MediaType,
} from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { submitReview } from "@/features/auth/actions";
import { TitleActions } from "@/features/catalog/TitleActions";
import styles from "./page.module.css";
export default async function Detail({
  params,
}: {
  params: Promise<{ locale: string; mediaType: string; id: string }>;
}) {
  const { locale, mediaType, id } = await params;
  if (!["movie", "tv"].includes(mediaType) || !/^\d+$/.test(id)) notFound();
  const item = await getDetail(locale, mediaType as MediaType, Number(id));
  if (!item) notFound();
  const t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  let reviews: {
    id: string;
    rating: number;
    body: string | null;
    youtube_video_id: string | null;
    user_id: string;
    profiles: { display_name: string; handle: string } | null;
  }[] = [];
  let playlists: { id: string; name: string }[] = [];
  const states: Record<string, boolean> = {};
  let likes = 0;
  if (db) {
    const [reviewsResult, countResult] = await Promise.all([
      db
        .from("reviews")
        .select(
          "id,rating,body,youtube_video_id,user_id,profiles(display_name,handle)",
        )
        .eq("media_type", mediaType)
        .eq("tmdb_id", Number(id))
        .order("created_at", { ascending: false }),
      db.rpc("title_like_count", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
      }),
    ]);
    reviews = (reviewsResult.data || []) as unknown as typeof reviews;
    likes = Number(countResult.data || 0);
    if (user) {
      const [f, w, l, p] = await Promise.all([
        db
          .from("favorites")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db
          .from("watched")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db
          .from("title_likes")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db.from("playlists").select("id,name").eq("user_id", user.id),
      ]);
      states.favorites = !!f.data;
      states.watched = !!w.data;
      states.title_likes = !!l.data;
      playlists = (p.data || []) as unknown as typeof playlists;
    }
  }
  const myReview = reviews.find((r) => r.user_id === user?.id);
  const poster = imageUrl(item.poster_path);
  return (
    <main>
      <div
        className={styles.backdrop}
        style={{
          backgroundImage: `linear-gradient(90deg,#100e0d 4%,#100e0ddd 38%,#100e0d33),linear-gradient(0deg,#100e0d,transparent 55%),url(${imageUrl(item.backdrop_path, "original") || ""})`,
        }}
      >
        <div className={`${styles.detail} container`}>
          <div className={styles.poster}>
            {poster ? (
              <img src={poster} alt={`${titleName(item)} poster`} />
            ) : (
              <span>{t.noPoster}</span>
            )}
          </div>
          <div className={styles.info}>
            <p className="eyebrow">
              {item.media_type === "movie" ? t.film : t.seriesOne} &nbsp; /
              &nbsp; {year(item)}
            </p>
            <h1>{titleName(item)}</h1>
            <p className={styles.meta}>
              {year(item)} {item.genres?.map((g) => ` · ${g.name}`).join("")}
              {item.runtime
                ? ` · ${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
                : ""}
            </p>
            <p className={styles.score}>
              <span>★</span> {item.vote_average?.toFixed(1) || "—"}{" "}
              <small>TMDB</small>{" "}
              <small>
                {" "}
                &nbsp; · &nbsp; ♡ {likes} {t.likes}
              </small>
            </p>
            <p className={styles.synopsis}>{item.overview || t.noOverview}</p>
            <TitleActions
              item={item}
              locale={locale}
              user={!!user}
              states={states}
              playlists={playlists}
            />
          </div>
        </div>
      </div>
      <div className={`${styles.content} container`}>
        <section>
          <h2>{t.cast}</h2>
          {item.credits?.cast?.length ? (
            <div className={styles.cast}>
              {item.credits.cast.slice(0, 6).map((c) => (
                <div key={c.id}>
                  <strong>{c.name}</strong>
                  <span>{c.character}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t.noCast}</p>
          )}
          <h2>{t.yourRating}</h2>
          {user ? (
            <form action={submitReview} className={styles.reviewForm}>
              <input type="hidden" name="media_type" value={mediaType} />
              <input type="hidden" name="tmdb_id" value={id} />
              <label>
                {t.yourRating}
                <select
                  name="rating"
                  required
                  defaultValue={myReview?.rating || ""}
                >
                  <option value="" disabled>
                    ☆ ☆ ☆ ☆ ☆
                  </option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)} ({n}/5)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.writeReview}
                <textarea
                  name="body"
                  rows={4}
                  defaultValue={myReview?.body || ""}
                  placeholder={t.writeReview}
                />
              </label>
              <label>
                {t.addVideo}
                <input
                  name="youtube"
                  type="url"
                  defaultValue={
                    myReview?.youtube_video_id
                      ? `https://www.youtube.com/watch?v=${myReview.youtube_video_id}`
                      : ""
                  }
                  placeholder="https://youtube.com/watch?v=…"
                />
              </label>
              <button className="button primary">{t.publish}</button>
            </form>
          ) : (
            <p className="muted">{t.signInPrompt}</p>
          )}
        </section>
        <section>
          <h2>{t.communityReviews}</h2>
          {reviews.length ? (
            reviews.map((r) => (
              <article className={styles.review} key={r.id}>
                <strong>{r.profiles?.display_name || t.member}</strong>
                <div className={styles.stars}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </div>
                {r.body && <p>{r.body}</p>}
                {r.youtube_video_id && (
                  <a
                    className="button"
                    href={`https://www.youtube.com/watch?v=${r.youtube_video_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ▶ YouTube
                  </a>
                )}
              </article>
            ))
          ) : (
            <p className="muted">{t.noReviews}</p>
          )}
        </section>
      </div>
    </main>
  );
}
