import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Cirqoo After Hours - Karaoke & Games",
  description:
    "Karaoke, games, and drinks at Halo Lagos, Lekki on Friday, November 6, 2026. Doors open at 6:00 PM UTC.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
