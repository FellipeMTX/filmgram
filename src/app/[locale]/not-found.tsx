"use client";
import { container } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
export default function NotFound() {
  const params = useParams(),
    locale = String(params.locale || "en"),
    t = messages(locale);
  return (
    <main className={cn(container, "py-20")}>
      <h1>{t.notFound}</h1>
      <Link className={buttonVariants()} href={`/${locale}/discover`}>
        {t.discover}
      </Link>
    </main>
  );
}
