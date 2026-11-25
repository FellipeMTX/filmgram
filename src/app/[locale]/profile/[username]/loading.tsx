"use client";

import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";

export default function Loading() {
  const { locale } = useParams<{ locale: string }>();
  return (
    <main className="mx-auto w-[min(1400px,90%)] py-16" aria-busy="true">
      <p role="status" className="sr-only">
        {messages(locale).loading}
      </p>
      <div className="h-40 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <div className="mt-8 h-8 w-1/3 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
      <div
        className="mt-8 grid grid-cols-2 gap-6 compact:grid-cols-1"
        aria-hidden="true"
      >
        <div className="h-64 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
      </div>
    </main>
  );
}
