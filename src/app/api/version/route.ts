/**
 * Returns the SHA of the currently-deployed build. Cheap, uncached,
 * public. The client polls this and compares against the SHA embedded
 * in its own JS bundle at build time — a mismatch means a new version
 * is live and the client should reload to pick it up.
 *
 * Why not rely on browser cache headers alone: iOS PWAs launched from
 * the home screen aggressively cache the entry HTML, and users don't
 * see fresh HTML until they manually clear cache or reinstall the app.
 * This poll lets a stale client detect + prompt-to-reload on its own.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
