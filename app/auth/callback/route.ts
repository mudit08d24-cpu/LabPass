// Finishes email confirmation and magic-link logins.
// Supabase sends the user here with ?code=...; we swap it for a login session, then redirect.
// Supabase -> Authentication -> URL Configuration must list:
//   https://<live-url>/auth/callback   and   http://localhost:3000/auth/callback
// After confirming, the roll number typed at sign-up (auth metadata) is copied into the profile,
// because A's grant lets students update only name and roll_no.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/browse";
  // Only allow redirects inside our own site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/browse";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const roll = (user?.user_metadata?.roll_no as string | undefined)?.trim();
      if (user && roll) {
        const { data: p } = await supabase.from("profiles").select("roll_no").eq("id", user.id).single();
        if (p && !p.roll_no) await supabase.from("profiles").update({ roll_no: roll }).eq("id", user.id);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  // The login page shows a "link expired" notice for error=confirm.
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
