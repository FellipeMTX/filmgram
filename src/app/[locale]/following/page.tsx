import { narrow, pageTitle, eyebrow } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import { currentUser } from "@/integrations/supabase";
import { signIn } from "@/features/auth/actions";
import { getFeed } from "@/features/social/feed";
import { FollowingFeed } from "@/features/social/FollowingFeed";

export default async function Following({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages(locale);
  const user = await currentUser();
  const feed = user ? await getFeed(locale) : null;
  return (
    <main className={`${narrow} max-w-[680px]`}>
      <p className={eyebrow}>{t.community}</p>
      <h1 className={pageTitle}>{t.following}</h1>
      {feed ? (
        <FollowingFeed initial={feed} locale={locale} />
      ) : (
        <>
          <p className="mb-4 text-muted-foreground">{t.signInPrompt}</p>
          <form action={signIn}>
            <input type="hidden" name="next" value={`/${locale}/following`} />
            <Button type="submit">{t.signIn}</Button>
          </form>
        </>
      )}
    </main>
  );
}
