import { SignInPanel } from "@/features/auth/SignInPanel";
import { narrow } from "@/lib/layout";
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className={narrow}>
      <SignInPanel
        context="profile"
        headingLevel="h1"
        locale={locale}
        next={`/${locale}/following`}
      />
    </main>
  );
}
