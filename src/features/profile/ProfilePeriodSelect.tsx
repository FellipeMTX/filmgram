"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export function ProfilePeriodSelect({
  label,
  period,
  options,
}: {
  label: string;
  period: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedPeriod, setSelectedPeriod] = useOptimistic(period);
  return (
    <NativeSelect
      aria-label={label}
      aria-busy={pending}
      value={selectedPeriod}
      size="sm"
      onChange={(event) => {
        const nextPeriod = event.currentTarget.value;
        const url = new URL(window.location.href);
        url.searchParams.set("period", nextPeriod);
        startTransition(() => {
          setSelectedPeriod(nextPeriod);
          router.push(url.pathname + url.search + url.hash, { scroll: false });
        });
      }}
    >
      {options.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
}
