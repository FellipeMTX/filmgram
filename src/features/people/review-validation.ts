export type ReviewWork = { media_type: "movie" | "tv"; tmdb_id: number };
export type ReviewActionState = {
  error?: "invalid" | "auth" | "unavailable" | "conflict" | "save";
  success?: boolean;
  updatedAt?: string;
};
function positiveId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : null;
}
export function parsePersonId(form: FormData): number | null {
  return positiveId(form.get("person_id"));
}
export function parseExpected(form: FormData): string | null | undefined {
  const raw = form.get("expected_updated_at");
  if (raw === null || raw === "") return null;
  if (
    typeof raw !== "string" ||
    raw.length > 80 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(raw) ||
    Number.isNaN(Date.parse(raw))
  )
    return undefined;
  return raw;
}
export function parsePersonReview(form: FormData): {
  personId: number;
  rating: number;
  body: string | null;
  works: ReviewWork[];
  expected: string | null;
} | null {
  const personId = parsePersonId(form);
  const ratingValue = form.get("rating");
  const bodyValue = form.get("body");
  const worksValue = form.get("works");
  const expected = parseExpected(form);
  if (
    !personId ||
    typeof ratingValue !== "string" ||
    !/^(?:[0-9]|10)$/.test(ratingValue) ||
    (bodyValue !== null && typeof bodyValue !== "string") ||
    typeof worksValue !== "string" ||
    worksValue.length > 10000 ||
    expected === undefined
  )
    return null;
  const body = (bodyValue || "").trim();
  if (Array.from(body).length > 10000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(worksValue);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 10) return null;
  const seen = new Set<string>();
  const works: ReviewWork[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return null;
    const value = entry as Record<string, unknown>;
    if (
      (value.media_type !== "movie" && value.media_type !== "tv") ||
      typeof value.tmdb_id !== "number" ||
      !Number.isSafeInteger(value.tmdb_id) ||
      value.tmdb_id <= 0
    )
      return null;
    const key = value.media_type + ":" + value.tmdb_id;
    if (seen.has(key)) return null;
    seen.add(key);
    works.push({ media_type: value.media_type, tmdb_id: value.tmdb_id });
  }
  return {
    personId,
    rating: Number(ratingValue),
    body: body || null,
    works,
    expected,
  };
}
