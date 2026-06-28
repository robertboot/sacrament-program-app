import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Build a redirect response that preserves the auth cookies Supabase may have
 * just refreshed during getUser(). If we return a fresh NextResponse.redirect
 * without copying those cookies over, the browser keeps presenting stale
 * cookies and bounces between authenticated / unauthenticated states (the
 * classic /home ↔ /login redirect loop).
 */
function redirectKeepingCookies(
  request: NextRequest,
  authResponse: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const redirect = NextResponse.redirect(url);
  for (const cookie of authResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password");
  const isPublic =
    path.startsWith("/p/") ||
    path.startsWith("/c/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/ics") ||
    path.startsWith("/api/sms/") ||
    path.startsWith("/api/cron/") ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/favicon.ico";

  if (!user && !isAuthRoute && !isPublic) {
    return redirectKeepingCookies(request, response, "/login", { next: path });
  }

  if (user && isAuthRoute) {
    return redirectKeepingCookies(request, response, "/home");
  }

  // Signed-in but no active unit yet → onboarding. /onboarding itself is
  // exempt to avoid a redirect loop, and /accept-invite is exempt because an
  // invited user lands there before they have any membership and we want
  // them to redeem the invite (not be forced to create a new unit).
  if (
    user &&
    !isAuthRoute &&
    !isPublic &&
    path !== "/onboarding" &&
    path !== "/accept-invite"
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_unit_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.active_unit_id) {
      return redirectKeepingCookies(request, response, "/onboarding");
    }
  }

  return response;
}
