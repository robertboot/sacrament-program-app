"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaderPosition, UnitType } from "@/lib/supabase/types";
import { createUnit } from "./actions";

const POSITION_OPTIONS: { value: LeaderPosition; label: string }[] = [
  { value: "president", label: "Bishop / Branch President" },
  { value: "first_counselor", label: "1st Counselor" },
  { value: "second_counselor", label: "2nd Counselor" },
  { value: "clerk", label: "Clerk" },
];

export function OnboardingForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(defaultName);
  const [unitType, setUnitType] = useState<UnitType>("branch");
  const [unitName, setUnitName] = useState("");
  const [position, setPosition] = useState<LeaderPosition>("president");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createUnit({
        full_name: fullName.trim(),
        unit_name: unitName.trim(),
        unit_type: unitType,
        position,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Welcome to ${unitName}!`);
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Your full name</Label>
            <Input
              id="full-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Robert Boot"
            />
            <p className="text-[11px] text-muted-foreground">
              How you&rsquo;ll appear on the printed program and to other
              members of your unit.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Unit type</Label>
            <Select
              value={unitType}
              onValueChange={(v) => setUnitType(v as UnitType)}
            >
              <SelectTrigger>
                <SelectValue>
                  {unitType === "ward" ? "Ward" : "Branch"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ward">Ward</SelectItem>
                <SelectItem value="branch">Branch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unit-name">
              {unitType === "ward" ? "Ward" : "Branch"} name
            </Label>
            <Input
              id="unit-name"
              required
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder={
                unitType === "ward" ? "e.g. Sandy 12th Ward" : "e.g. Talladega Branch"
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Your role</Label>
            <Select
              value={position}
              onValueChange={(v) => setPosition(v as LeaderPosition)}
            >
              <SelectTrigger>
                <SelectValue>
                  {POSITION_OPTIONS.find((p) => p.value === position)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              You can invite others (counselors, clerk, chorister) once setup
              is complete.
            </p>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create unit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
