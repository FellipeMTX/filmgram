"use client";
import { container } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <main className={cn(container, "py-20")}>
      <h1>{t.error}</h1>
      <Button type="button" onClick={reset}>
        {t.tryAgain}
      </Button>
    </main>
  );
}
