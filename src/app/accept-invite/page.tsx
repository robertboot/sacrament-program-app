import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadInvite } from "./actions";
import { AcceptInviteClient } from "./accept-invite-client";

export const metadata = { title: "Accept invite — Rota" };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Send the visitor to log in, preserving the invite token in `next`.
    const next = `/accept-invite?invite=${token ?? ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!token) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Missing invite link</h1>
          <p className="text-sm text-muted-foreground">
            The page was opened without an invite token. Ask whoever invited
            you to resend the link.
          </p>
        </div>
      </main>
    );
  }

  const { invite, error } = await loadInvite(token);

  if (error || !invite) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Invite unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <AcceptInviteClient
        invite={invite}
        callerEmail={user.email ?? ""}
      />
    </main>
  );
}
