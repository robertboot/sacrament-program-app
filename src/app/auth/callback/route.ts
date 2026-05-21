import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles email-confirmation / magic-link redirects from Supabase.
//
// Two link shapes are supported:
//   ?code=…               (PKCE flow — only works in the same browser that
//                          requested the link)
//   ?token_hash=…&type=…  (token-hash flow — works for invited users whose
//                          browser never issued the request; this is what
//                          the Magic Link email template must use)
//
// On verification failure we redirect to /login with ?error=… so the bishop
// can see *why* an invited user couldn't sign in (silent failures masked
// invite issues for a long time).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Missing verification token in link.")}`,
  );
}
