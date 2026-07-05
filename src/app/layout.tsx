import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Overture — Casting & Production for Community Theatre",
    template: "%s · Overture",
  },
  description:
    "Overture is where community theatres post auditions, actors find their next role, and whole productions run in one place — from signup sheet to closing night.",
  openGraph: {
    siteName: "Overture",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Overture",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2a1225",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-cream-50 text-curtain-900 font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
