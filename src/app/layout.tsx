import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteDisclaimer } from "@/components/site-disclaimer";
import "./globals.css";

// Body text uses the system font stack — SF Pro on iOS/macOS, Segoe on
// Windows, Roboto on Android, and Arial as the universal fallback. Reads
// instantly native on every device without a webfont download. Mono stays
// Geist Mono for code/numbers where we need it.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rota",
  description: "Plan and share sacrament meeting programs from the high stand.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rota",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteDisclaimer />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
