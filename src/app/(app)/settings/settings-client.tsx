"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, Pencil, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { weeksSinceLabel } from "@/lib/dates";
import { bishopricPositionLabel, unitLabels, type UnitType } from "@/lib/labels";
import {
  HYMN_USAGE_LABELS,
  type AppSettings,
  type BishopricPosition,
  type Hymn,
  type HymnUsageTag,
  type Profile,
} from "@/lib/supabase/types";
import {
  addBishopricMember,
  addChoristerMember,
  inviteMember,
  sendInviteEmail,
  removeMember,
  updateBishopricMember,
  updateChoristerMember,
  updateHymnMeta,
  updateSettings,
} from "./actions";

export function SettingsClient({
  settings,
  profiles,
  hymns,
}: {
  settings: AppSettings;
  profiles: Profile[];
  hymns: Hymn[];
}) {
  const [pending, start] = useTransition();
  const [branchName, setBranchName] = useState(settings.branch_name);
  const [welcome, setWelcome] = useState(settings.default_welcome_text);
  const [template, setTemplate] = useState(settings.assignment_paper_template);
  const [calendarUrl, setCalendarUrl] = useState(settings.calendar_ics_url ?? "");
  const [unitType, setUnitType] = useState<UnitType>(settings.unit_type);
  const [wbFooter, setWbFooter] = useState(settings.ward_business_footer ?? "");
  const [inviteUrl, setInviteUrl] = useState<{ id: string; name: string; email: string; url: string } | null>(
    null,
  );
  const labels = unitLabels(unitType);

  function saveSettings() {
    start(async () => {
      const r = await updateSettings({
        branch_name: branchName,
        default_welcome_text: welcome,
        assignment_paper_template: template,
        calendar_ics_url: calendarUrl.trim() || null,
        unit_type: unitType,
        ward_business_footer: wbFooter,
      });
      if (r.error) toast.error(r.error);
      else toast.success("Settings saved.");
    });
  }

  const bishopricMembers = profiles.filter((p) => p.role === "bishopric");
  const choristers = profiles.filter((p) => p.role === "chorister");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Branch info, default text, and user access.
        </p>
      </div>

      <CollapsibleCard
        title="Unit"
        defaultOpen={false}
        contentClassName="space-y-3"
      >
        <div className="space-y-1.5">
          <Label>Unit type</Label>
          <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
            <SelectTrigger className="w-48">
              <SelectValue>{unitType === "ward" ? "Ward" : "Branch"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ward">Ward</SelectItem>
              <SelectItem value="branch">Branch</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Wards have a Bishop. Branches have a Branch President. Affects program text
            and titles throughout the app.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>{labels.unit} name</Label>
          <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Default welcome text</Label>
          <Textarea rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{labels.unit} business footer</Label>
          <Textarea rows={2} value={wbFooter} onChange={(e) => setWbFooter(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Church calendar (iCal feed URL)</Label>
          <Input
            type="url"
            placeholder="https://churchofjesuschrist.org/church-calendar/services/…"
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={pending}>
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Speaking Assignment Template"
        defaultOpen={false}
        contentClassName="space-y-3"
      >
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Textarea
            rows={6}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Printed below the topic on each speaker&apos;s assignment paper.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={pending}>
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title={labels.leadership}
        description={
          <>
            Counselors have full access to the app. Add their email so they
            can receive a sign-in invite. Replacing a member revokes the
            previous person&apos;s access.
          </>
        }
        contentClassName="space-y-4"
      >
        <BishopricList
          members={bishopricMembers}
          unitType={unitType}
          pending={pending}
          start={start}
          onInvite={setInviteUrl}
        />
        <AddBishopricForm
          existingPositions={bishopricMembers
            .map((p) => p.bishopric_position)
            .filter((x): x is BishopricPosition => !!x)}
          unitType={unitType}
          pending={pending}
          start={start}
          onInvite={setInviteUrl}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Choristers"
        description={
          <>
            Choristers can view every program and edit hymns. Replacing a
            chorister revokes the previous person&apos;s sign-in.
          </>
        }
        contentClassName="space-y-4"
      >
        <ChoristerList
          members={choristers}
          pending={pending}
          start={start}
          onInvite={setInviteUrl}
        />
        <AddChoristerForm
          pending={pending}
          start={start}
          onInvite={setInviteUrl}
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Hymn notes & tags"
        defaultOpen={false}
        description={
          <>
            Flag hymns that are only for certain occasions (funeral,
            baptism, holidays, sacrament prep) and record verse notes.
            Tagged hymns show a warning in the picker; verse notes can be
            printed on a program.
          </>
        }
        contentClassName="space-y-3"
      >
        <HymnTagEditor hymns={hymns} pending={pending} start={start} />
      </CollapsibleCard>

      <InviteLinkDialog
        invite={inviteUrl}
        onClose={() => setInviteUrl(null)}
      />
    </div>
  );
}

// ───────────────────────── Bishopric ─────────────────────────

function BishopricList({
  members,
  unitType,
  pending,
  start,
  onInvite,
}: {
  members: Profile[];
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  const labels = unitLabels(unitType);
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No {labels.leadership.toLowerCase()} members yet.
      </p>
    );
  }
  const order: Record<BishopricPosition, number> = {
    bishop: 0,
    first_counselor: 1,
    second_counselor: 2,
  };
  const sorted = [...members].sort(
    (a, b) =>
      (order[a.bishopric_position!] ?? 99) -
      (order[b.bishopric_position!] ?? 99),
  );
  return (
    <div className="space-y-2">
      {sorted.map((m) => (
        <BishopricRow
          key={m.id}
          member={m}
          unitType={unitType}
          pending={pending}
          start={start}
          onInvite={onInvite}
        />
      ))}
    </div>
  );
}

function BishopricRow({
  member,
  unitType,
  pending,
  start,
  onInvite,
}: {
  member: Profile;
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  const [editing, setEditing] = useState(false);

  function doInvite() {
    start(async () => {
      const r = await inviteMember(member.id);
      if (r.error) toast.error(r.error);
      else if (r.inviteLink && r.email) {
        onInvite({
          id: member.id,
          name: member.full_name,
          email: r.email,
          url: r.inviteLink,
        });
      } else {
        toast.error("Couldn't generate an invite link.");
      }
    });
  }

  function doRemove() {
    if (
      !confirm(
        `Remove ${member.full_name} from the ${unitLabels(
          unitType,
        ).leadership.toLowerCase()}? This revokes their sign-in access.`,
      )
    )
      return;
    start(async () => {
      const r = await removeMember(member.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${member.full_name} removed.`);
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{member.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {bishopricPositionLabel(member.bishopric_position, unitType)}
            {member.email ? <> · {member.email}</> : <> · no email on file</>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Last conducted: {weeksSinceLabel(member.last_conducted_date)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={doInvite}
          disabled={pending || !member.email}
          title={
            member.email
              ? "Email a sign-in link (re-invite)"
              : "Add an email first to invite this member"
          }
        >
          <Mail className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          disabled={pending}
          onClick={doRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <BishopricEditDialog
        open={editing}
        member={member}
        unitType={unitType}
        pending={pending}
        start={start}
        onClose={() => setEditing(false)}
      />
    </>
  );
}

function BishopricEditDialog({
  open,
  member,
  unitType,
  pending,
  start,
  onClose,
}: {
  open: boolean;
  member: Profile;
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.full_name);
  const [email, setEmail] = useState(member.email ?? "");
  const [position, setPosition] = useState<BishopricPosition>(
    member.bishopric_position!,
  );
  const [trackedId, setTrackedId] = useState(member.id);
  if (member.id !== trackedId) {
    setTrackedId(member.id);
    setName(member.full_name);
    setEmail(member.email ?? "");
    setPosition(member.bishopric_position!);
  }

  function save() {
    if (!name.trim() || !email.trim()) return;
    start(async () => {
      const r = await updateBishopricMember(member.id, {
        full_name: name.trim(),
        email: email.trim(),
        position,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Updated.");
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {member.full_name}</DialogTitle>
          <DialogDescription>
            Email is required so we can send a sign-in invite. Changing the
            position will swap with whoever currently holds it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Select
              value={position}
              onValueChange={(v) => setPosition(v as BishopricPosition)}
            >
              <SelectTrigger>
                <SelectValue>
                  {bishopricPositionLabel(position, unitType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bishop">
                  {unitType === "ward" ? "Bishop" : "Branch President"}
                </SelectItem>
                <SelectItem value="first_counselor">1st Counselor</SelectItem>
                <SelectItem value="second_counselor">2nd Counselor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending || !name.trim() || !email.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddBishopricForm({
  existingPositions,
  unitType,
  pending,
  start,
  onInvite,
}: {
  existingPositions: BishopricPosition[];
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  const labels = unitLabels(unitType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState<BishopricPosition | "">("");
  const positions: { value: BishopricPosition; label: string }[] = [
    { value: "bishop", label: labels.leaderRole },
    { value: "first_counselor", label: "1st Counselor" },
    { value: "second_counselor", label: "2nd Counselor" },
  ];
  const available = positions.filter((p) => !existingPositions.includes(p.value));

  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground border-t pt-3">
        All three bishopric slots are filled.
      </p>
    );
  }

  function submit() {
    if (!name.trim() || !email.trim() || !position) return;
    start(async () => {
      const r = await addBishopricMember({
        name: name.trim(),
        email: email.trim(),
        position: position as BishopricPosition,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${name.trim()} added.`);
        if (r.inviteLink) onInvite({
          id: r.id,
          name: name.trim(),
          email: email.trim(),
          url: r.inviteLink,
        });
        setName("");
        setEmail("");
        setPosition("");
      }
    });
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">
          Add {labels.leadership.toLowerCase()} member
        </span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select
          value={position}
          onValueChange={(v) => setPosition(v as BishopricPosition)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Position">
              {position ? bishopricPositionLabel(position as BishopricPosition, unitType) : ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        We&apos;ll generate a sign-in link you can forward to their email or
        text message. The link signs them in directly.
      </p>
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={pending || !name.trim() || !email.trim() || !position}
        >
          Add and create invite link
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Choristers ─────────────────────────

function ChoristerList({
  members,
  pending,
  start,
  onInvite,
}: {
  members: Profile[];
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No choristers yet.</p>
    );
  }
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <ChoristerRow
          key={m.id}
          member={m}
          pending={pending}
          start={start}
          onInvite={onInvite}
        />
      ))}
    </div>
  );
}

function ChoristerRow({
  member,
  pending,
  start,
  onInvite,
}: {
  member: Profile;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  const [editing, setEditing] = useState(false);

  function doInvite() {
    start(async () => {
      const r = await inviteMember(member.id);
      if (r.error) toast.error(r.error);
      else if (r.inviteLink && r.email) {
        onInvite({
          id: member.id,
          name: member.full_name,
          email: r.email,
          url: r.inviteLink,
        });
      }
    });
  }

  function doRemove() {
    if (
      !confirm(
        `Remove ${member.full_name}? This revokes their sign-in access permanently.`,
      )
    )
      return;
    start(async () => {
      const r = await removeMember(member.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${member.full_name} removed.`);
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{member.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {member.email ?? "no email on file"}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={doInvite}
          disabled={pending || !member.email}
          title={
            member.email
              ? "Send a sign-in link"
              : "Add an email first to invite this chorister"
          }
        >
          <Mail className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          disabled={pending}
          onClick={doRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <ChoristerEditDialog
        open={editing}
        member={member}
        pending={pending}
        start={start}
        onClose={() => setEditing(false)}
      />
    </>
  );
}

function ChoristerEditDialog({
  open,
  member,
  pending,
  start,
  onClose,
}: {
  open: boolean;
  member: Profile;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.full_name);
  const [email, setEmail] = useState(member.email ?? "");
  const [trackedId, setTrackedId] = useState(member.id);
  if (member.id !== trackedId) {
    setTrackedId(member.id);
    setName(member.full_name);
    setEmail(member.email ?? "");
  }

  function save() {
    if (!name.trim() || !email.trim()) return;
    start(async () => {
      const r = await updateChoristerMember(member.id, {
        full_name: name.trim(),
        email: email.trim(),
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Updated.");
        onClose();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {member.full_name}</DialogTitle>
          <DialogDescription>
            Choristers can view every program and edit hymns. Email is required
            for the sign-in invite.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending || !name.trim() || !email.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddChoristerForm({
  pending,
  start,
  onInvite,
}: {
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onInvite: (i: { id: string; name: string; email: string; url: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function submit() {
    if (!name.trim() || !email.trim()) return;
    start(async () => {
      const r = await addChoristerMember({
        name: name.trim(),
        email: email.trim(),
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${name.trim()} added.`);
        if (r.inviteLink) onInvite({
          id: r.id,
          name: name.trim(),
          email: email.trim(),
          url: r.inviteLink,
        });
        setName("");
        setEmail("");
      }
    });
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Add chorister</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        We&apos;ll generate a sign-in link you can forward. They&apos;ll only
        be able to view programs and edit hymns.
      </p>
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={pending || !name.trim() || !email.trim()}
        >
          Add and create invite link
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Invite link dialog ─────────────────────────

function defaultInviteMessage(name: string, url: string): string {
  return [
    `Hi ${name.trim()},`,
    `I'd like to invite you to use Rota — a small tool I'm using to plan our sacrament meetings, manage speaking assignments, and share the printed program with the congregation.`,
    `Tap this link to sign in directly (no account needed up front — you can set a password after you're in):`,
    url,
    `The link is good for 48 hours. Let me know if you have any questions!`,
  ].join("\n\n");
}

// ───────────────────────── Hymn tags ─────────────────────────

const USAGE_ORDER: HymnUsageTag[] = [
  "sacrament",
  "funeral",
  "baptism",
  "stake_conference",
  "christmas",
  "easter",
  "palm_sunday",
  "fourth_of_july",
];

function HymnTagEditor({
  hymns,
  pending,
  start,
}: {
  hymns: Hymn[];
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Hymn | null>(null);

  const query = q.trim().toLowerCase();
  const tagged = hymns.filter(
    (h) => (h.usage_tags?.length ?? 0) > 0 || h.verse_note,
  );
  const matches = query
    ? hymns
        .filter(
          (h) =>
            `${h.number}`.includes(query) ||
            h.title.toLowerCase().includes(query),
        )
        .slice(0, 25)
    : tagged;

  return (
    <>
      <Input
        placeholder="Search hymns by number or title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!query && (
        <p className="text-xs text-muted-foreground">
          Showing {tagged.length} already-tagged hymn
          {tagged.length === 1 ? "" : "s"}. Search to tag others.
        </p>
      )}
      <div className="divide-y rounded-md border">
        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground p-3">
            {query ? "No hymns match." : "No hymns tagged yet."}
          </p>
        )}
        {matches.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setEditing(h)}
            className="w-full text-left p-3 hover:bg-accent transition-colors"
          >
            <div className="font-medium text-sm">
              #{h.number} — {h.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {h.usage_tags?.length
                ? h.usage_tags
                    .map(
                      (t) =>
                        HYMN_USAGE_LABELS[t as HymnUsageTag] ?? t,
                    )
                    .join(", ")
                : "No tags"}
              {h.verse_note ? ` · ${h.verse_note}` : ""}
            </div>
          </button>
        ))}
      </div>
      {editing && (
        <HymnTagDialog
          hymn={editing}
          pending={pending}
          start={start}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function HymnTagDialog({
  hymn,
  pending,
  start,
  onClose,
}: {
  hymn: Hymn;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
  onClose: () => void;
}) {
  const [tags, setTags] = useState<string[]>(hymn.usage_tags ?? []);
  const [verseNote, setVerseNote] = useState(hymn.verse_note ?? "");

  function toggle(tag: HymnUsageTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function save() {
    start(async () => {
      const r = await updateHymnMeta(hymn.id, {
        usage_tags: tags,
        verse_note: verseNote.trim() || null,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Hymn updated.");
        onClose();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            #{hymn.number} — {hymn.title}
          </DialogTitle>
          <DialogDescription>
            Tags show a warning in the hymn picker. The verse note can be
            printed on a program via a per-slot checkbox in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Intended for</Label>
            <div className="grid grid-cols-2 gap-2">
              {USAGE_ORDER.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <Checkbox
                    checked={tags.includes(tag)}
                    onCheckedChange={() => toggle(tag)}
                  />
                  {HYMN_USAGE_LABELS[tag]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Verse note</Label>
            <Input
              placeholder="e.g. Verses 1, 3, 5, 6"
              value={verseNote}
              onChange={(e) => setVerseNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({
  invite,
  onClose,
}: {
  invite: { id: string; name: string; email: string; url: string } | null;
  onClose: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<"message" | "link" | null>(null);
  const [message, setMessage] = useState("");
  const [trackedUrl, setTrackedUrl] = useState<string | null>(null);
  const [sending, sendStart] = useTransition();

  function sendEmail() {
    if (!invite) return;
    sendStart(async () => {
      const r = await sendInviteEmail(invite.id);
      if (r.error) toast.error(r.error);
      else toast.success(`Invite emailed to ${r.email}.`);
    });
  }

  // Re-init the message whenever the dialog opens for a fresh invite.
  if (invite && invite.url !== trackedUrl) {
    setTrackedUrl(invite.url);
    setMessage(defaultInviteMessage(invite.name, invite.url));
  }

  function copyText(text: string, key: "message" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      toast.success(key === "message" ? "Message copied." : "Link copied.");
    });
  }

  return (
    <Dialog
      open={!!invite}
      onOpenChange={(o) => {
        if (!o) {
          setCopiedKey(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite {invite?.name}</DialogTitle>
          <DialogDescription>
            Send the sign-in link to <strong>{invite?.email}</strong> or copy
            it to share via text. The link is good for 48 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <Label htmlFor="invite-message" className="text-xs uppercase tracking-wider text-muted-foreground">
              Message to send
            </Label>
            <Textarea
              id="invite-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              // Override the Textarea component's field-sizing-content, which
              // would otherwise expand the box to fit a long, unbreakable URL
              // and drag the entire dialog out past the viewport. wrap=hard
              // forces hard newlines on overflow; break-all + min-w-0 let
              // mid-URL wraps render properly.
              wrap="hard"
              className="text-sm w-full max-w-full min-w-0 break-all [field-sizing:fixed] resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Tweak the wording if you&rsquo;d like — the link must stay in the body for the recipient to click through.
            </p>
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Link only
            </div>
            <div className="rounded-md border bg-muted/40 p-2 text-[11px] break-all font-mono max-w-full min-w-0 overflow-hidden">
              {invite?.url}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => invite && copyText(invite.url, "link")}
          >
            {copiedKey === "link" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedKey === "link" ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="outline"
            onClick={() => copyText(message, "message")}
          >
            {copiedKey === "message" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedKey === "message" ? "Copied" : "Copy message"}
          </Button>
          <Button onClick={sendEmail} disabled={sending}>
            <Mail className="w-4 h-4" />
            {sending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
