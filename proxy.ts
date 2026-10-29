// Next.js 16 proxy (formerly middleware):
//  1. keeps the Supabase session cookie fresh so B's server actions and RLS reads see the signed-in user;
//  2. sends signed-out visitors of app pages to /login?next=…;
//  3. keeps people out of staff areas they don't hold a role for (server-side copy of the screens' RequireHat).
// A's row-level security still decides what data anyone can read; this only keeps the UI tidy.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Hat = "student" | "manager" | "owner" | "admin";

/** Staff areas and who may open them. Checked in order; first match wins. */
const AREAS: { test: RegExp; hats: Hat[] }[] = [
  { test: /^\/owner\/resources\/[^/]+\/qr$/, hats: ["owner", "manager", "admin"] },
  { test: /^\/owner(\/|$)/, hats: ["owner", "admin"] },
  { test: /^\/admin\/radar$/, hats: ["admin", "owner"] },
  { test: /^\/admin(\/|$)/, hats: ["admin"] },
  { test: /^\/manage(\/|$)/, hats: ["manager", "owner", "admin"] },
];

/** Pages anyone can open without signing in. */
const PUBLIC = /^\/($|login|signup|auth\/)/;

export async function proxy(request: NextRequest) {
  // Demo mode (or Supabase not configured yet): the session lives in the browser, nothing to check here.
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path: string = request.nextUrl.pathname;
  if (PUBLIC.test(path)) return response;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    const [pathname, query] = to.split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c: { name: string; value: string }) => r.cookies.set(c.name, c.value));
    return r;
  };

  if (!user) return redirect(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);

  const area = AREAS.find((a) => a.test.test(path));
  if (!area) return response;

  // profiles.roles holds student/manager/admin; "owner" means owning a department (A's departments.owner_id).
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("roles").eq("id", user.id).maybeSingle(),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  const hats = new Set<Hat>(((profile?.roles as string[] | undefined) ?? []) as Hat[]);
  if ((count ?? 0) > 0) hats.add("owner");
  if (area.hats.some((h) => hats.has(h))) return response;

  // Wrong door: send them to their own home.
  const home = hats.has("admin") ? "/admin/radar" : hats.has("manager") ? "/manage/requests" : hats.has("owner") ? "/owner/resources" : "/browse";
  return redirect(home);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|api/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)"],
};
