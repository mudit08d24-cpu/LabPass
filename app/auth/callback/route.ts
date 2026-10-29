// Finishes email confirmation and magic-link logins.
// Supabase sends the user here with ?code=...; we swap it for a login session, then redirect.
// Supabase -> Authentication -> URL Configuration must list:
//   https://<live-url>/auth/callback   and   http://localhost:3000/auth/callback
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow redirects inside our own site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
