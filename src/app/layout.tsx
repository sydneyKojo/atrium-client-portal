import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap", variable: "--font-serif" });

// Applies the saved theme before first paint, so dark-mode users never see a light flash.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "Atrium · The client portal for agencies", template: "%s" },
  description: "Give every client one private place for project progress, shared files and invoices they can pay by card.",
  applicationName: "Atrium",
};

export const viewport: Viewport = {
  themeColor: "#f1ece2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
