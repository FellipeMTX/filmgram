import Image from "next/image";
import { messages } from "@/i18n/messages";

export default async function Credits({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages(locale);
  return (
    <main className="container" style={{ paddingBlock: "48px 80px" }}>
      <h1>{t.credits}</h1>
      <a href="https://www.themoviedb.org" aria-label="The Movie Database">
        <Image
          src="/tmdb-logo.svg"
          alt="The Movie Database"
          width={196}
          height={14}
        />
      </a>
      <p>{t.attribution}</p>
      {locale !== "en" && <p lang="en">{messages("en").attribution}</p>}
    </main>
  );
}
