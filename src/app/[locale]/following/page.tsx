import { Card } from "@/components/ui/card";
import { narrow, pageTitle, eyebrow } from "@/lib/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { signIn } from "@/features/auth/actions";
export default async function Following({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params,
    t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  let reviews: {
    id: string;
    media_type: string;
    tmdb_id: number;
    rating: number;
    body: string | null;
    youtube_video_id: string | null;
    created_at: string;
    profiles: { display_name: string; handle: string } | null;
  }[] = [];
  if (db && user) {
    const { data: follows } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const ids = (follows || []).map((x) => x.following_id);
    if (ids.length) {
      const { data } = await db
        .from("reviews")
        .select(
          "id,media_type,tmdb_id,rating,body,youtube_video_id,created_at,profiles(display_name,handle)",
        )
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      reviews = (data || []) as unknown as typeof reviews;
    }
  }
  return (
    <main className={narrow}>
      <p className={eyebrow}>{t.community}</p>
      <h1 className={pageTitle}>{t.following}</h1>
      {!user ? (
        <>
          <p className="text-muted-foreground">{t.signInPrompt}</p>
          <form action={signIn}>
            <input type="hidden" name="next" value={`/${locale}/following`} />
            <Button type="submit">{t.signIn}</Button>
          </form>
        </>
      ) : reviews.length ? (
        reviews.map((r) => (
          <Card asChild key={r.id}>
            <article className="[&_small]:float-right [&_small]:text-muted-foreground">
              <Link href={`/${locale}/profile/${r.profiles?.handle || ""}`}>
                <strong>{r.profiles?.display_name || t.member}</strong>
              </Link>
              <small>{new Date(r.created_at).toLocaleDateString(locale)}</small>
              <p>
                <Link href={`/${locale}/title/${r.media_type}/${r.tmdb_id}`}>
                  {t.viewDetails} ↗
                </Link>
              </p>
              <div className="text-[22px] text-primary">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </div>
              {r.body && <p>{r.body}</p>}
              {r.youtube_video_id && (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={`https://www.youtube.com/watch?v=${r.youtube_video_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ▶ YouTube
                </a>
              )}
            </article>
          </Card>
        ))
      ) : (
        <p className="text-muted-foreground">{t.followingEmpty}</p>
      )}
    </main>
  );
}
