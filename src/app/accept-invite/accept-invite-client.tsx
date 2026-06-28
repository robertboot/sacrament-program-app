"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redeemInvite } from "./actions";

const POSITION_LABELS: Record<string, string> = {
  president: "Bishop / Branch President",
  first_counselor: "1st Counselor",
  second_counselor: "2nd Counselor",
  clerk: "Clerk",
};

export function AcceptInviteClient({
  invite,
  callerEmail,
}: {
  invite: {
    token: string;
    unit_name: string;
    role: "leader" | "chorister";
    position: string | null;
    email: string;
    inviter_name: string | null;
  };
  callerEmail: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const emailMismatch =
    callerEmail.trim().toLowerCase() !== invite.email.trim().toLowerCase();

  const roleLabel =
    invite.role === "leader"
      ? invite.position
        ? POSITION_LABELS[invite.position] ?? "Leader"
        : "Leader"
      : "Chorister";

  function accept() {
    start(async () => {
      const r = await redeemInvite(invite.token);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Welcome to ${invite.unit_name}!`);
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join {invite.unit_name}</CardTitle>
        <CardDescription>
          {invite.inviter_name
            ? `${invite.inviter_name} invited you `
            : "You've been invited "}
          to help plan sacrament meetings as{" "}
          <span className="font-medium text-foreground">{roleLabel}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div>
            Invited email:{" "}
            <span className="font-medium text-foreground">{invite.email}</span>
          </div>
          <div>
            Signed in as:{" "}
            <span className="font-medium text-foreground">
              {callerEmail || "(not signed in)"}
            </span>
          </div>
        </div>
        {emailMismatch && (
          <p className="text-xs text-red-600">
            This invite is for {invite.email}. Sign out and sign back in with
            that email to accept.
          </p>
        )}
        <Button
          onClick={accept}
          disabled={pending || emailMismatch}
          className="w-full"
        >
          {pending ? "Joining…" : `Accept and join ${invite.unit_name}`}
        </Button>
      </CardContent>
    </Card>
  );
}
