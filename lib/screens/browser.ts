// Browser Supabase client for the screens' reads (A's row-level security decides what comes back).
// Writes never go through this client: they call B's server actions (API.md).

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function browserDb() {
  if (!client) {
    client = createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}
