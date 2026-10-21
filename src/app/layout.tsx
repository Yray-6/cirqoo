import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

const description =
  "Karaoke, games, and drinks at Halo Lagos, Lekki on Friday, November 6, 2026. Doors open at 6:00 PM UTC.";

export const viewport: Viewport = {
  themeColor: "#fc6435",
};

export const metadata: Metadata = {
  metadataBase: new URL((process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "")),
  title: "Cirqoo After Hours - Karaoke & Games",
  description,
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Cirqoo",
    images: [
      {
        url: "/flyer-mobile.png",
        width: 696,
        height: 870,
        alt: "Cirqoo After Hours flyer. Ticket price ₦15k, Friday, November 6th, 2026 at Halo Lagos, Lekki.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
