"use client";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchField({
  label,
  clearLabel,
  clearHref,
  submitLabel,
  name = "q",
  initialValue = "",
  onValueChange,
  submit = true,
}: {
  label: string;
  clearLabel: string;
  clearHref?: string;
  submitLabel?: string;
  name?: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
  submit?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  function change(next: string) {
    setValue(next);
    onValueChange?.(next);
  }
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <label className="min-w-[180px] flex-1 text-sm font-bold">
        {label}
        <Input
          name={name}
          type="search"
          placeholder={label}
          maxLength={100}
          value={value}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            if (!submit && event.key === "Enter") event.preventDefault();
          }}
          className="mt-1"
        />
      </label>
      {value &&
        (clearHref ? (
          <Button variant="outline" asChild>
            <Link href={clearHref} onClick={() => change("")}>
              {clearLabel}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => change("")}>
            {clearLabel}
          </Button>
        ))}
      {submit && <Button type="submit">{submitLabel}</Button>}
    </div>
  );
}
