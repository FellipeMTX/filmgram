"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

let pendingFocus: string | null = null;

export function MovieCountrySelect({
  label,
  locale,
  id,
  tab,
  region,
  regions,
}: {
  label: string;
  locale: string;
  id: number;
  tab: string;
  region: string;
  regions: string[];
}) {
  const router = useRouter();
  const control = useRef<HTMLSelectElement>(null);
  const focusKey = `${locale}:${id}:${tab}:${region}`;

  useEffect(() => {
    if (pendingFocus !== focusKey) return;
    pendingFocus = null;
    if (document.activeElement === document.body) {
      control.current?.focus({ preventScroll: true });
    }
  }, [focusKey]);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <label className="mb-5 block text-sm font-bold">
      {label}
      <NativeSelect
        ref={control}
        value={region}
        onChange={(event) => {
          const value = event.target.value;
          pendingFocus =
            document.activeElement === event.target
              ? `${locale}:${id}:${tab}:${value}`
              : null;
          router.replace(
            `/${locale}/title/movie/${id}?tab=${tab}&country=${value}`,
            { scroll: false },
          );
        }}
      >
        {regions.map((code) => (
          <option key={code} value={code}>
            {names.of(code) || code}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
