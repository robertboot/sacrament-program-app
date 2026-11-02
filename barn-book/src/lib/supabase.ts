import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  if (import.meta.env.VITE_DEMO !== "1") {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — see README.md"
    );
  }
}

// In a demo build the client exists but is never called (see db.ts).
export const supabase = createClient(
  url || "https://demo.invalid",
  anonKey || "demo"
);
