import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Role Radar | Search company job boards",
  description: "Find jobs by title and location. Live company listings and automatic searches across 18 hiring platforms, free and without a search API key.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
