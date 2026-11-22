"use client";
import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
export default function Loading() {
  const params = useParams();
  return (
    <main className="container state" aria-busy="true">
      {messages(String(params.locale)).loading}…
    </main>
  );
}
