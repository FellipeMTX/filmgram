import { narrow, pageTitle, eyebrow } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { currentUser, supabase } from "@/integrations/supabase";
import { signIn } from "@/features/auth/actions";
import { getFavorites } from "@/features/library/queries";
import { savedCollectionLabels } from "@/features/catalog/saved-collection-labels";
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
    <main className={narrow}>
      <p className={eyebrow}>{t.collection}</p>
      <h1 className={pageTitle}>{savedCollectionLabels(locale).saved}</h1>
      {user && <p className="text-muted-foreground">{t.private}</p>}
      {!user ? (
        <>
          <p className="text-muted-foreground">{t.signInPrompt}</p>
          <form action={signIn}>
            <input type="hidden" name="next" value={`/${locale}/favorites`} />
            <Button type="submit">{t.signIn}</Button>
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
        <p className="text-muted-foreground">{t.noFavorites}</p>
      )}
    </main>
  );
}
