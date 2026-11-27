import { InterviewSignIn } from "@/features/auth/InterviewSignIn";
import { narrow } from "@/lib/layout";
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className={narrow}>
      <InterviewSignIn locale={locale} />
    </main>
  );
}
