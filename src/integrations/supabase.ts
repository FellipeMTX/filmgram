import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.generated";
import { cookies } from "next/headers";
export async function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies. */
        }
      },
    },
  });
}
export async function currentUser() {
  const db = await supabase();
  if (!db) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}
