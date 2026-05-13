"use client";

import { useState } from "react";
import { BookMarked } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const BREAD_PRAYER =
  "O God, the Eternal Father, we ask thee in the name of thy Son, Jesus Christ, to bless and sanctify this bread to the souls of all those who partake of it, that they may eat in remembrance of the body of thy Son, and witness unto thee, O God, the Eternal Father, that they are willing to take upon them the name of thy Son, and always remember him and keep his commandments which he has given them; that they may always have his Spirit to be with them. Amen.";

export const WATER_PRAYER =
  "O God, the Eternal Father, we ask thee in the name of thy Son, Jesus Christ, to bless and sanctify this water to the souls of all those who drink of it, that they may do it in remembrance of the blood of thy Son, which was shed for them; that they may witness unto thee, O God, the Eternal Father, that they do always remember him, that they may have his Spirit to be with them. Amen.";

export function SacramentPrayersButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Show the bread and water blessings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 underline underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
      >
        <BookMarked className="w-4 h-4" />
        Sacrament Prayers
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sacrament Prayers</DialogTitle>
            <DialogDescription>
              D&amp;C 20:77–79. For reference at the pulpit.
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest font-semibold">
              Blessing on the bread
            </h3>
            <p className="text-sm leading-relaxed">{BREAD_PRAYER}</p>
          </section>
          <section className="space-y-2 pt-2 border-t">
            <h3 className="text-xs uppercase tracking-widest font-semibold">
              Blessing on the water
            </h3>
            <p className="text-sm leading-relaxed">{WATER_PRAYER}</p>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
