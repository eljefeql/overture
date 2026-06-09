import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
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
  title: {
    default: "Overture — Community Theatre Casting",
    template: "%s | Overture",
  },
  description:
    "The casting and talent platform for community theatre. Find auditions, manage casting, build your theatre career.",
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
