import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "peer_supervisor" | "owner" | "manager" | "admin";

// Throws unless the logged-in user has at least one of the allowed roles.
// Roles come from profiles.roles (text[]) as in the PRD data model.
export async function requireRole(allowed: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  const roles: string[] = profile?.roles ?? [];
  if (!roles.some((r) => (allowed as string[]).includes(r))) throw new Error("Not allowed");
  return user;
}
