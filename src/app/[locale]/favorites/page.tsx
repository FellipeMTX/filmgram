import Link from "next/link";
import { currentUser, supabase } from "@/integrations/supabase";
import { signIn } from "@/features/auth/actions";
import { getFavorites } from "@/features/social/queries";
import { messages } from "@/i18n/messages";

export default async function Favorites({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages(locale);
  const user = await currentUser();
  const db = await supabase();
  const favorites = user && db ? await getFavorites(db, user.id) : [];
  return (
    <main className="container narrow">
      <p className="eyebrow">{t.collection}</p>
      <h1 className="pageTitle">{t.favorites}</h1>
      {!user ? (
        <>
          <p className="muted">{t.signInPrompt}</p>
          <form action={signIn}>
            <input type="hidden" name="next" value={`/${locale}/favorites`} />
            <button className="button primary">{t.signIn}</button>
          </form>
        </>
      ) : favorites.length ? (
        <ul>
          {favorites.map((item) => (
            <li key={`${item.media_type}-${item.tmdb_id}`}>
              <Link
                href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}
              >
                {item.media_title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t.noFavorites}</p>
      )}
    </main>
  );
}
