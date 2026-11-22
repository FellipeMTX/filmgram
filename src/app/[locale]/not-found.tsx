"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
export default function NotFound() {
  const params = useParams(),
    locale = String(params.locale || "en"),
    t = messages(locale);
  return (
    <main className="container state">
      <h1>{t.notFound}</h1>
      <Link className="button primary" href={`/${locale}/discover`}>
        {t.discover}
      </Link>
    </main>
  );
}
