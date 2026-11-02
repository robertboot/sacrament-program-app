import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { IS_DEMO } from "../lib/db";
import { supabase } from "../lib/supabase";

type Phase = "loading" | "signed-out" | "sent" | "signed-in";

export function AuthGate({ children }: { children: ReactNode }) {
  if (IS_DEMO) return <>{children}</>;
  return <AuthGateReal>{children}</AuthGateReal>;
}

function AuthGateReal({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setPhase(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        setPhase((prev) =>
          session ? "signed-in" : prev === "sent" ? "sent" : "signed-out"
        );
      }
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setError(error.message);
    else setPhase("sent");
  }

  if (phase === "signed-in") return <>{children}</>;

  if (phase === "loading") {
    return (
      <div className="min-h-svh bg-paper" aria-busy="true" />
    );
  }

  return (
    <div className="min-h-svh bg-paper flex flex-col items-center justify-center px-6">
      <h1 className="font-serif text-4xl text-ink">Barn Book</h1>
      <p className="mt-1 text-soft text-sm">
        Vaccination &amp; treatment records for the farm
      </p>

      {phase === "sent" ? (
        <div className="mt-8 w-full max-w-sm bg-card border border-line rounded-sm p-5 text-center">
          <p className="text-ink">Check your email.</p>
          <p className="mt-1 text-sm text-soft">
            We sent a sign-in link to <span className="text-ink">{email}</span>.
            Open it on this device.
          </p>
          <button
            className="mt-4 min-h-11 px-4 text-brass underline underline-offset-2"
            onClick={() => setPhase("signed-out")}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 w-full max-w-sm bg-card border border-line rounded-sm p-5">
          <label htmlFor="email" className="block text-sm text-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-sm border border-line bg-paper px-3 text-ink"
            placeholder="you@example.com"
          />
          {error && <p className="mt-2 text-sm text-overdue">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="mt-4 w-full min-h-11 rounded-sm bg-brass text-card font-medium disabled:opacity-60"
          >
            {sending ? "Sending…" : "Email me a sign-in link"}
          </button>
          <p className="mt-3 text-xs text-soft">
            No passwords — a link in your email signs you in.
          </p>
        </form>
      )}
    </div>
  );
}

export async function signOut() {
  if (IS_DEMO) return;
  await supabase.auth.signOut();
}
