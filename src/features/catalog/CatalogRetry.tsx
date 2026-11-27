"use client";
import { useRouter } from "next/navigation";

export function CatalogRetry({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      onClick={() => router.refresh()}
    >
      {label}
    </button>
  );
}
