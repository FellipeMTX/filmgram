"use client";
import { container } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
export default function Loading() {
  const params = useParams();
  return (
    <main className={cn(container, "py-20")} aria-busy="true">
      {messages(String(params.locale)).loading}…
    </main>
  );
}
