import { cn } from "@/lib/utils";
import { narrow, pageTitle, eyebrow } from "@/lib/layout";
import { messages } from "@/i18n/messages";
import { getSocialViewer } from "@/features/social/social-viewer";
import { SignInPanel } from "@/features/auth/SignInPanel";
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
        <SignInPanel
          locale={locale}
          next={`/${locale}/following`}
          context="following"
        />
      )}
    </main>
  );
}
