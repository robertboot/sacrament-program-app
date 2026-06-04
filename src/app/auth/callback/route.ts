import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

// Handles email-confirmation / magic-link / recovery redirects from Supabase.
//
// Two link shapes are supported:
//   ?code=…               (PKCE flow — same browser that requested it)
//   ?token_hash=…&type=…  (token-hash flow — emailed invites; the inviter's
//                          browser and the recipient's browser differ)
//
// The session cookies set during verifyOtp / exchangeCodeForSession must be
// attached to the NextResponse we return. Using `cookies()` from
// `next/headers` indirectly drops them on redirect responses in some Next
// versions, which left invited users authenticated on the server but
// unauthenticated in their browser — i.e. forced back to /login. We build
// the response up-front and write cookies straight to it.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  let response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return response;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return response;
  }
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Missing verification token in link.")}`,
  );
}
