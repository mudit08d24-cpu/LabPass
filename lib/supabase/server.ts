// Supabase client for server code (server actions, server components), acting as the logged-in user.
// Row-Level Security and A's database functions see auth.uid() as that user.
// Standard @supabase/ssr setup, typed with A's generated types (lib/supabase/types.ts).
// If the repo already has lib/supabase/server.ts, keep that one: B's code works with either,
// because it gets its client through getDb() in lib/actions/db.ts.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component, where cookies are read-only. The middleware refreshes them.
          }
        },
      },
    },
  );
}
