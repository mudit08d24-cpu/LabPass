// Supabase client for the browser (client components), acting as the logged-in user.
// Standard @supabase/ssr setup, typed with A's generated types (lib/supabase/types.ts).
// If the repo already has lib/supabase/client.ts, keep that one.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
