import type { ChangeEventHandler, Ref } from "react";

export function PopcornIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M5.3 9.1C3 8.7 3.1 5.5 5.5 5.2c-.2-2.3 3-3.1 4.1-1.1 1.2-2.5 4.4-2.5 5.4 0 1.4-1.7 4.4-.8 4.2 1.4 2.2.2 2.5 3.4.1 3.8"
        fill="currentColor"
        opacity=".65"
      />
      <path
        d="M4.5 9h15l-1.6 12H6.1L4.5 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 9 .7 12m6.3-12-.7 12"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function FilmgramRating({
  value,
  locale,
  className = "",
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
  const label =
    locale === "pt-BR"
      ? `Nota Filmgram: ${number} de 10`
      : locale === "es"
        ? `Nota Filmgram: ${number} de 10`
        : `Filmgram rating: ${number} out of 10`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${className}`}
    >
      <span className="sr-only">{label}</span>
      <PopcornIcon className="size-5 shrink-0 text-primary" />
      <span aria-hidden="true">{number}/10</span>
    </span>
  );
}

export function FilmgramRatingPicker({
  value,
  defaultValue,
  onChange,
  disabled,
  ref,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {Array.from({ length: 11 }, (_, n) => (
        <label key={n} className="relative cursor-pointer text-center">
          <input
            ref={n === 0 ? ref : undefined}
            className="peer sr-only"
            type="radio"
            name="rating"
            value={n}
            required
            disabled={disabled}
            {...(value !== undefined
              ? { checked: value === String(n) }
              : { defaultChecked: defaultValue === String(n) })}
            onChange={onChange}
            aria-label={`${n}/10`}
          />
          <span
            aria-hidden="true"
            className="flex min-w-9 flex-col items-center rounded-md border border-border px-1 py-1 text-xs text-subtle peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
          >
            {n > 0 ? (
              <PopcornIcon className="size-6 text-primary" />
            ) : (
              <span className="grid size-6 place-items-center text-sm">0</span>
            )}
            <span>{n}/10</span>
          </span>
        </label>
      ))}
    </span>
  );
}
