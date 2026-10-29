import "server-only";
import { createClient } from "@supabase/supabase-js";

// Database client with FULL rights (ignores Row-Level Security).
// Server only — never import this in a "use client" file.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
