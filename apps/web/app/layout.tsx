import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { siteConfig } from "../lib/config.js";

import "./globals.css";

const glide = localFont({
  display: "swap",
  src: "../public/glide-variable.woff2",
  variable: "--font-glide",
  weight: "100 950",
});
const mono = localFont({
  display: "swap",
  src: "../public/glide-mono.woff2",
  variable: "--font-glide-mono",
  weight: "400",
});
const title = siteConfig.title;

export const metadata: Metadata = {
  authors: [siteConfig.author],
  creator: siteConfig.author.name,
  description: siteConfig.description,
  metadataBase: new URL("https://blode.co"),
  openGraph: {
    description: siteConfig.description,
    siteName: siteConfig.author.name,
    title,
    type: "website",
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: { default: title, template: "%s | Taste Lint" },
  twitter: { card: "summary_large_image", creator: "@mattblode" },
};
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fbb6cd",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${glide.variable} ${mono.variable}`} lang="en">
      <body>
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-4"
          href="#main-content"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
