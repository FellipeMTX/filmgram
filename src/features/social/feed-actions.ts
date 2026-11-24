"use server";
import { getFeed, type Cursor } from "./feed";
export async function loadFollowing(locale: string, cursor: Cursor) {
  return getFeed(locale, cursor);
}
