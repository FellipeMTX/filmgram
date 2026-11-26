"use client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useParams<{ locale: string }>();
  const text =
    locale === "pt-BR"
      ? ["Não foi possível carregar o perfil.", "Tentar novamente"]
      : locale === "es"
        ? ["No se pudo cargar el perfil.", "Reintentar"]
        : ["Could not load this profile.", "Try again"];
  return (
    <main className="mx-auto w-[min(1400px,90%)] py-16">
      <p role="alert" className="mb-4">
        {text[0]}
      </p>
      <Button onClick={reset}>{text[1]}</Button>
    </main>
  );
}
