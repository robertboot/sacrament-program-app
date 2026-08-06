import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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

  // Fast path: public routes don't need an auth check at all. Previously
  // every navigation (including the anonymous congregation bulletin at
  // /p/[token] and every /api/cron/* and /ics tick) round-tripped to
  // Supabase's auth server before this check ran, adding a full
  // network hop of latency to requests that don't care who's viewing.
  if (isPublic) return NextResponse.next({ request });

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

  // getClaims() reads + verifies the JWT locally; getUser() hits the
  // auth server. For the redirect decision we only need to know whether
  // a session cookie is present and valid, so getClaims is enough here.
  const { data: claims } = await supabase.auth.getClaims();
  const hasSession = !!claims?.claims?.sub;

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return response;
}
