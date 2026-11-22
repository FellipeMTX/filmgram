"use client";
import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const params = useParams(),
    t = messages(String(params.locale));
  return (
    <main className="container state">
      <h1>{t.error}</h1>
      <button className="button primary" onClick={reset}>
        {t.tryAgain}
      </button>
    </main>
  );
}
