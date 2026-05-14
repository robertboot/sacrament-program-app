"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { weeksSinceLabel } from "@/lib/dates";
import { bishopricPositionLabel, unitLabels, type UnitType } from "@/lib/labels";
import type { AppSettings, BishopricPosition, Profile, UserRole } from "@/lib/supabase/types";
import {
  addBishopricMember,
  removeBishopricMember,
  updateBishopricMember,
  updateSettings,
  updateUserRole,
} from "./actions";

const POSITIONS: { value: BishopricPosition; label: string }[] = [
  { value: "bishop", label: "Bishop" },
  { value: "first_counselor", label: "1st Counselor" },
  { value: "second_counselor", label: "2nd Counselor" },
];

export function SettingsClient({
  settings,
  profiles,
}: {
  settings: AppSettings;
  profiles: Profile[];
}) {
  const [pending, start] = useTransition();
  const [branchName, setBranchName] = useState(settings.branch_name);
  const [welcome, setWelcome] = useState(settings.default_welcome_text);
  const [template, setTemplate] = useState(settings.assignment_paper_template);
  const [calendarUrl, setCalendarUrl] = useState(settings.calendar_ics_url ?? "");
  const [unitType, setUnitType] = useState<UnitType>(settings.unit_type);
  const [wbFooter, setWbFooter] = useState(settings.ward_business_footer ?? "");
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Branch info, default text, and user roles.
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
            <p className="text-xs text-muted-foreground">
              Appears in program headers and on assignment papers.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Default welcome text</Label>
            <Textarea
              rows={3}
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pre-fills the welcome paragraph on new programs.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Assignment paper template</Label>
            <Textarea
              rows={4}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Printed below the topic on each speaker&apos;s assignment paper.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{labels.unit} business footer</Label>
            <Textarea
              rows={2}
              value={wbFooter}
              onChange={(e) => setWbFooter(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Printed at the bottom of the {labels.unit} Business section on every program,
              even when there is no other business.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Church calendar (iCal feed URL)</Label>
            <Input
              type="url"
              placeholder="https://churchofjesuschrist.org/church-calendar/services/…"
              value={calendarUrl}
              onChange={(e) => setCalendarUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The Events page will pull from this feed (4-week display window by default,
              ending on the event date). Get your subscription URL from
              calendar.churchofjesuschrist.org → Settings.
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
            Add {labels.leadership.toLowerCase()} members so they show up in the
            conducting picker and the rotation. They don&apos;t need to sign up
            first — the {labels.leaderRole.toLowerCase()} manages everything for
            them.
          </>
        }
        contentClassName="space-y-4"
      >
          <BishopricList
            members={profiles.filter((p) => p.role === "bishopric")}
            unitType={unitType}
            pending={pending}
            start={start}
          />
          <AddBishopricForm
            existingPositions={profiles
              .filter((p) => p.role === "bishopric")
              .map((p) => p.bishopric_position)
              .filter((x): x is BishopricPosition => !!x)}
            unitType={unitType}
            pending={pending}
            start={start}
          />
      </CollapsibleCard>

      <CollapsibleCard
        title="Other users"
        description={
          <>
            Anyone who signs up appears here. Choristers can edit hymns; promote
            to bishopric from above if you need to move someone in/out of the
            rotation.
          </>
        }
        contentClassName="divide-y"
      >
        {profiles.filter((p) => p.role === "chorister").length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No chorister users yet.</p>
        )}
        {profiles
          .filter((p) => p.role === "chorister")
          .map((p) => (
            <UserRow key={p.id} profile={p} pending={pending} start={start} />
          ))}
      </CollapsibleCard>
    </div>
  );
}

function BishopricList({
  members,
  unitType,
  pending,
  start,
}: {
  members: Profile[];
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
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
    (a, b) => (order[a.bishopric_position!] ?? 99) - (order[b.bishopric_position!] ?? 99),
  );
  return (
    <div className="space-y-2">
      {sorted.map((m) => (
        <BishopricRow key={m.id} member={m} unitType={unitType} pending={pending} start={start} />
      ))}
    </div>
  );
}

function BishopricRow({
  member,
  unitType,
  pending,
  start,
}: {
  member: Profile;
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.full_name);
  const [position, setPosition] = useState<BishopricPosition>(member.bishopric_position!);

  const dirty = name.trim() !== member.full_name || position !== member.bishopric_position;

  function save() {
    if (!name.trim()) return;
    start(async () => {
      const r = await updateBishopricMember(member.id, { full_name: name.trim(), position });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Updated.");
        setEditing(false);
      }
    });
  }

  function cancel() {
    setName(member.full_name);
    setPosition(member.bishopric_position!);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{member.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {bishopricPositionLabel(member.bishopric_position, unitType)} · Last conducted:{" "}
            {weeksSinceLabel(member.last_conducted_date)}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove ${member.full_name} from the bishopric?`)) return;
            start(async () => {
              const r = await removeBishopricMember(member.id);
              if (r.error) toast.error(r.error);
              else toast.success("Removed.");
            });
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="py-3 border-b last:border-b-0 space-y-2">
      <div className="grid sm:grid-cols-[1fr_180px] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        <Select value={position} onValueChange={(v) => setPosition(v as BishopricPosition)}>
          <SelectTrigger>
            <SelectValue>{bishopricPositionLabel(position, unitType)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bishop">{unitType === "ward" ? "Bishop" : "Branch President"}</SelectItem>
            <SelectItem value="first_counselor">1st Counselor</SelectItem>
            <SelectItem value="second_counselor">2nd Counselor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending || !dirty || !name.trim()}>
          Save
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Picking a position another member holds swaps the two positions.
      </p>
    </div>
  );
}

function AddBishopricForm({
  existingPositions,
  unitType,
  pending,
  start,
}: {
  existingPositions: BishopricPosition[];
  unitType: UnitType;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
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
    if (!name.trim() || !position) return;
    start(async () => {
      const r = await addBishopricMember({
        name: name.trim(),
        email: email.trim() || null,
        position: position as BishopricPosition,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${name.trim()} added.`);
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
        <span className="text-sm font-medium">Add {labels.leadership.toLowerCase()} member</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email (optional)"
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
              {position ? bishopricPositionLabel(position as BishopricPosition) : ""}
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
        Email is optional. Without one we create a placeholder account they can claim later by
        signing in with their real email.
      </p>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending || !name.trim() || !position}>
          Add
        </Button>
      </div>
    </div>
  );
}

function UserRow({
  profile,
  pending,
  start,
}: {
  profile: Profile;
  pending: boolean;
  start: (cb: () => void | Promise<void>) => void;
}) {
  const [role, setRole] = useState<UserRole>(profile.role);
  const [position, setPosition] = useState<BishopricPosition | null>(profile.bishopric_position);

  function save() {
    start(async () => {
      const r = await updateUserRole(profile.id, role, role === "bishopric" ? position : null);
      if (r.error) toast.error(r.error);
      else toast.success("User updated.");
    });
  }

  const changed =
    role !== profile.role ||
    (role === "bishopric" && position !== profile.bishopric_position);

  return (
    <div className="py-3 flex flex-wrap gap-3 items-center">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{profile.full_name}</div>
        {profile.role === "bishopric" && profile.bishopric_position && (
          <div className="text-xs text-muted-foreground">
            {bishopricPositionLabel(profile.bishopric_position)}
          </div>
        )}
      </div>
      <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
        <SelectTrigger className="w-36">
          <SelectValue>{role === "bishopric" ? "Leadership" : "Chorister"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="chorister">Chorister</SelectItem>
          <SelectItem value="bishopric">Leadership</SelectItem>
        </SelectContent>
      </Select>
      {role === "bishopric" && (
        <Select
          value={position ?? "_none"}
          onValueChange={(v) => setPosition(v === "_none" ? null : (v as BishopricPosition))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Position">{bishopricPositionLabel(position)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button size="sm" onClick={save} disabled={pending || !changed}>
        Save
      </Button>
    </div>
  );
}
