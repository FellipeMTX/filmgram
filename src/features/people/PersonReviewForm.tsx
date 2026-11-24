"use client";
import {
  useActionState,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SearchField } from "@/components/SearchField";
import {
  normalizeSearch,
  type PersonWork,
} from "@/features/people/filmography";
import {
  savePersonReview,
  deletePersonReview,
} from "@/features/people/review-actions";
import { titleName } from "@/integrations/tmdb-display";
import { messages } from "@/i18n/messages";

type Reference = { mediaType: "movie" | "tv"; tmdbId: number };
type ExistingReview = {
  rating: number;
  body: string | null;
  updatedAt: string;
  works: Reference[];
};
// Controlled fields must wait for React before accepting input.
const subscribe = () => () => {};
const isHydrated = () => true;
const isServerRender = () => false;

const keyOf = (ref: Reference) => `${ref.mediaType}:${ref.tmdbId}`;
export function PersonReviewForm({
  locale,
  personId,
  works,
  review,
}: {
  locale: string;
  personId: number;
  works: PersonWork[];
  review: ExistingReview | null;
}) {
  const t = messages(locale);
  const hydrated = useSyncExternalStore(subscribe, isHydrated, isServerRender);
  const [saveState, saveAction, saving] = useActionState(savePersonReview, {});
  const [deleteState, deleteAction, deleting] = useActionState(
    deletePersonReview,
    {},
  );
  const version = review?.updatedAt || "";
  const [loadedVersion, setLoadedVersion] = useState(version);
  const [rating, setRating] = useState(review ? String(review.rating) : "");
  const ratingField = useRef<HTMLSelectElement>(null);
  const [body, setBody] = useState(review?.body || "");
  const [latestAction, setLatestAction] = useState<"save" | "delete">("save");
  const [selected, setSelected] = useState<Reference[]>(review?.works || []);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const lookup = useMemo(
    () => new Map(works.map((work) => [`${work.media_type}:${work.id}`, work])),
    [works],
  );
  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return works
      .filter(
        (work) =>
          !q ||
          [work.title, work.name, work.original_title, work.original_name].some(
            (name) => normalizeSearch(name || "").includes(q),
          ),
      )
      .slice(0, 30);
  }, [works, search]);
  if (loadedVersion !== version) {
    setLoadedVersion(version);
    setRating(review ? String(review.rating) : "");
    setBody(review?.body || "");
    setSelected(review?.works || []);
    setSearch("");
    setConfirm(false);
  }
  useLayoutEffect(() => {
    // A form action resets the native select after React applies its value.
    const select = ratingField.current;
    if (select && select.value !== rating) select.value = rating;
  }, [rating, saving, saveState, version]);
  const feedback = latestAction === "save" ? saveState : deleteState;
  const pending = saving || deleting;
  const errors: Record<string, string> = {
    invalid: t.reviewInvalid,
    auth: t.reviewAuth,
    unavailable: t.reviewUnavailable,
    conflict: t.reviewConflict,
    save: t.reviewError,
  };
  function toggle(ref: Reference) {
    setSelected((current) =>
      current.some((x) => keyOf(x) === keyOf(ref))
        ? current.filter((x) => keyOf(x) !== keyOf(ref))
        : current.length < 10
          ? [...current, ref]
          : current,
    );
  }
  return (
    <fieldset disabled={!hydrated} className="min-w-0 border-0 p-0">
      <form
        action={saveAction}
        onSubmit={() => setLatestAction("save")}
        onReset={(event) => event.preventDefault()}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="person_id" value={personId} />
        <input type="hidden" name="expected_updated_at" value={version} />
        <input
          type="hidden"
          name="works"
          value={JSON.stringify(
            selected.map((ref) => ({
              media_type: ref.mediaType,
              tmdb_id: ref.tmdbId,
            })),
          )}
        />
        <label className="flex flex-col gap-2 font-bold">
          {t.yourRating}
          <NativeSelect
            ref={ratingField}
            name="rating"
            required
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="" disabled>
              {t.selectRating}
            </option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n}/5)
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-2 font-bold">
          {t.reviewBody}
          <Textarea
            name="body"
            rows={4}
            maxLength={10000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <fieldset className="min-w-0 rounded-md border border-border p-3">
          <legend className="px-1 font-bold">{t.reviewReferences}</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            {t.referencesLimit}
          </p>
          <SearchField
            key={version}
            label={t.searchReferences}
            clearLabel={t.clearSearch}
            name="reference_search"
            submit={false}
            onValueChange={setSearch}
          />
          {selected.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold">{t.referencesSelected}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {selected.map((ref) => {
                  const work = lookup.get(keyOf(ref));
                  return (
                    <li key={keyOf(ref)}>
                      <button
                        type="button"
                        onClick={() => toggle(ref)}
                        className="rounded-full border border-border px-2 py-1 text-xs"
                      >
                        {work
                          ? titleName(work)
                          : `${t.unavailableReference} (${ref.mediaType} ${ref.tmdbId})`}{" "}
                        <span aria-hidden="true">×</span>
                        <span className="sr-only"> {t.remove}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
            {filtered.length ? (
              filtered.map((work) => {
                const ref = { mediaType: work.media_type, tmdbId: work.id };
                const checked = selected.some((x) => keyOf(x) === keyOf(ref));
                return (
                  <label
                    key={keyOf(ref)}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selected.length >= 10}
                      onChange={() => toggle(ref)}
                    />
                    <span>
                      {titleName(work)} (
                      {work.media_type === "movie" ? t.film : t.seriesOne})
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.noReferenceResults}
              </p>
            )}
          </div>
        </fieldset>
        <Button type="submit" disabled={pending} className="self-start">
          {saving ? t.saving : t.publish}
        </Button>
      </form>
      {review && (
        <div className="mt-4">
          {confirm ? (
            <form
              action={deleteAction}
              onSubmit={() => setLatestAction("delete")}
              className="flex flex-wrap gap-2"
            >
              <input type="hidden" name="person_id" value={personId} />
              <input type="hidden" name="expected_updated_at" value={version} />
              <Button type="submit" variant="outline" disabled={pending}>
                {t.deleteConfirm}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirm(false)}
              >
                {t.deleteCancel}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm(true)}
            >
              {t.deleteReview}
            </Button>
          )}
        </div>
      )}
      {!pending && feedback.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errors[feedback.error] || t.reviewError}
        </p>
      )}
      {!pending && feedback.success && (
        <p role="status" className="mt-3 text-sm">
          {latestAction === "save"
            ? t.reviewSavedPerson
            : t.reviewDeletedPerson}
        </p>
      )}
    </fieldset>
  );
}
