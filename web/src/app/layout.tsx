import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kongre Beacon Paneli",
  description: "Kongre, salon ve beacon yönetim paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <nav className="panel-nav">
          <Link href="/congresses">Kongreler</Link>
          <Link href="/halls">Salonlar</Link>
          <Link href="/beacons">Beacon&apos;lar</Link>
          <Link href="/attendance">Canlı Takip</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
