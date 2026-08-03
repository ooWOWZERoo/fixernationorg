import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Fixer Nation",
    template: "%s | Fixer Nation",
  },
  description:
    "Fixer Nation — a community built for people who take action, solve problems, and keep moving forward.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://fixernation.org",
    siteName: "Fixer Nation",
  },
  robots: {
    index: false, // set to true at Phase 1 launch
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
