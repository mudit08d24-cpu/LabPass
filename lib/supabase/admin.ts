import "server-only";

// Supabase client with the service-role key, for background jobs only (app/api/jobs).
// It bypasses Row-Level Security, so never import it from a server action a user can call,
// and never from a client component. The "server-only" import makes a client import fail the build.
// Returned with B's loose Db type (lib/actions/db.ts), like getDb().
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/lib/actions/db";

export function createAdminClient(): Db {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as Db;
}
