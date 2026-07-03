import type { Metadata, Viewport } from "next";
import { AsthmaTracker } from "./asthma-tracker";

export const metadata: Metadata = {
  title: "Annelies's Asthma Tracker",
  description:
    "A private asthma diary — log peak flow, symptoms and inhaler use, and see the trend over time.",
  robots: { index: false, follow: false },
  manifest: "/asthma/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Annelies",
  },
  icons: {
    icon: [
      { url: "/asthma/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/asthma/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/asthma/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fefaf4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function AsthmaPage() {
  return <AsthmaTracker />;
}
