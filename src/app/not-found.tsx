import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground mt-2">
        That program doesn&apos;t exist, or you don&apos;t have access.
      </p>
      <Link href="/" className={cn(buttonVariants(), "mt-4")}>
        Back to dashboard
      </Link>
    </main>
  );
}
