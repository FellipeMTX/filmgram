"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export function MovieCountrySelect({
  label,
  region,
  regions,
}: {
  label: string;
  region: string;
  regions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label={label}
      aria-busy={pending}
      className="max-w-40 px-2.5 py-2 text-sm"
      value={region}
      onChange={(event) => {
        const url = new URL(window.location.href);
        url.searchParams.set("country", event.target.value);
        startTransition(() => {
          router.replace(url.pathname + url.search + url.hash, {
            scroll: false,
          });
        });
      }}
    >
      {regions.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}
