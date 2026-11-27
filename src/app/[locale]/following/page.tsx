import { cn } from "@/lib/utils";
import { narrow, pageTitle, eyebrow } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import { getSocialViewer } from "@/features/social/social-viewer";
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
  const { user, db } = await getSocialViewer();
  const feed = user ? await getFeed(locale) : null;
  let hasFollowing = false;
  if (user && db && feed && !feed.items.length) {
    const result = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(1);
    if (result.error) throw result.error;
    hasFollowing = !!result.data.length;
  }
  return (
    <main className={cn(narrow, "max-w-[760px]")}>
      <p className={eyebrow}>{t.community}</p>
      <h1 className={pageTitle}>{t.following}</h1>
      {feed ? (
        <FollowingFeed
          initial={feed}
          locale={locale}
          userId={user!.id}
          hasFollowing={hasFollowing}
        />
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
