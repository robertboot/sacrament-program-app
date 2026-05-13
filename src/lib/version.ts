/**
 * App version surfaced in the UI. We append the short commit SHA the build
 * was deployed from so each publish has a distinct version string and we
 * can tell at a glance which build is in front of us. The SHA arrives via
 * NEXT_PUBLIC_COMMIT_SHA, which next.config.ts forwards from Vercel's
 * VERCEL_GIT_COMMIT_SHA at build time. Locally falls back to "dev".
 */
const SHA = process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7);

export const APP_VERSION = SHA ? `0.2.0-${SHA}` : "0.2.0-dev";
