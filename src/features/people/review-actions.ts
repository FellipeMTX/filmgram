"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/integrations/supabase";
import { getPersonDetails } from "@/integrations/tmdb";
import {
  parseExpected,
  parsePersonId,
  parsePersonReview,
  type ReviewActionState,
} from "./review-validation";

export async function savePersonReview(
  _previous: ReviewActionState,
  form: FormData,
): Promise<ReviewActionState> {
  const input = parsePersonReview(form);
  if (!input) return { error: "invalid" };
  const db = await supabase();
  if (!db) return { error: "unavailable" };
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) return { error: "auth" };
  try {
    const person = await getPersonDetails("en", input.personId);
    if (!person) return { error: "invalid" };
    const valid = new Set(
      person.works.map((work) => work.media_type + ":" + work.id),
    );
    if (input.expected) {
      const { data: current, error } = await db
        .from("person_reviews")
        .select("id,updated_at,person_review_works(media_type,tmdb_id)")
        .eq("person_tmdb_id", input.personId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return { error: "save" };
      if (!current || current.updated_at !== input.expected)
        return { error: "conflict" };
      for (const work of current.person_review_works)
        valid.add(work.media_type + ":" + work.tmdb_id);
    }
    if (
      input.works.some(
        (work) => !valid.has(work.media_type + ":" + work.tmdb_id),
      )
    )
      return { error: "invalid" };
    const { data: reviewId, error } = await db.rpc("save_person_review", {
      p_person_id: input.personId,
      p_rating: input.rating,
      p_body: input.body ?? "",
      p_works: input.works,
      p_expected_updated_at: input.expected ?? undefined,
    });
    if (error) return { error: error.code === "40001" ? "conflict" : "save" };
    revalidatePath("/", "layout");
    const { data: saved, error: readError } = await db
      .from("person_reviews")
      .select(
        "updated_at,rating,body,person_review_works(media_type,tmdb_id,position)",
      )
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .single();
    if (readError || !saved) return { error: "save" };
    const savedWorks = [...saved.person_review_works]
      .sort((a, b) => a.position - b.position)
      .map(({ media_type, tmdb_id }) => ({ media_type, tmdb_id }));
    if (
      saved.rating !== input.rating ||
      saved.body !== input.body ||
      JSON.stringify(savedWorks) !== JSON.stringify(input.works)
    )
      return { error: "conflict" };
    return { success: true, updatedAt: saved.updated_at };
  } catch {
    return { error: "unavailable" };
  }
}

export async function deletePersonReview(
  _previous: ReviewActionState,
  form: FormData,
): Promise<ReviewActionState> {
  const personId = parsePersonId(form);
  const expected = parseExpected(form);
  if (!personId || !expected) return { error: "invalid" };
  const db = await supabase();
  if (!db) return { error: "unavailable" };
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) return { error: "auth" };
  const { data, error } = await db
    .from("person_reviews")
    .delete()
    .eq("user_id", user.id)
    .eq("person_tmdb_id", personId)
    .eq("updated_at", expected)
    .select("id");
  if (error) return { error: "save" };
  if (!data.length) return { error: "conflict" };
  revalidatePath("/", "layout");
  return { success: true };
}
