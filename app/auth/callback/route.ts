// Finishes Supabase email confirmation (A's README: Redirect URL /auth/callback), then copies the
// roll number typed at sign-up into the profile (students may update name and roll_no).

import { NextResponse, type NextRequest } from "next/server";
import { serverDb } from "@/lib/screens/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/browse";
  if (code) {
    const db = await serverDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await db.auth.getUser();
      const user = data.user;
      const roll = (user?.user_metadata?.roll_no as string | undefined)?.trim();
      if (user && roll) {
        const { data: p } = await db.from("profiles").select("roll_no").eq("id", user.id).single();
        if (p && !p.roll_no) await db.from("profiles").update({ roll_no: roll }).eq("id", user.id);
      }
      return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/browse", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}
