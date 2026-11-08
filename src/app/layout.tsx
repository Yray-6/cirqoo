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
  "A sample night out at Sample Hall on Saturday, June 20, 2026. Doors open at 7:00 PM UTC.";

export const viewport: Viewport = {
  themeColor: "#fc6435",
};

export const metadata: Metadata = {
  metadataBase: new URL((process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "")),
  title: "Open Tickets Night",
  description,
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Open Tickets",
    images: [
      {
        url: "/flyer-placeholder.svg",
        width: 696,
        height: 870,
        alt: "Open Tickets Night flyer. Sample Hall, Saturday, June 20th, 2026.",
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
