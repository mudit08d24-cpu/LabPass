// Email confirmation that works in any browser or device.
// The Supabase "Confirm signup" email template links here with a one-time token:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// Unlike /auth/callback (?code=…), this doesn't need the browser that signed up, so a link opened
// on a phone or in another browser still confirms the account and signs the person in.
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "magiclink", "email_change"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/browse";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/browse";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Copy the roll number typed at sign-up into the profile (A's grant lets students set it).
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
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
