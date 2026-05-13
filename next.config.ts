import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public share pages must never be cached by the browser — otherwise a
  // home-screen bookmark on a phone keeps serving the first HTML it ever
  // loaded and the bishop's later updates never show up.
  async headers() {
    return [
      {
        source: "/p/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
