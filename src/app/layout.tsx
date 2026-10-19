import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Editor-chrome typeface only — exposed as --font-inter and consumed by
// the `font-ui` utility (globals.css). The canvas document never inherits
// it; see Workspace.tsx.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Layoutry",
  description:
    "Layoutry is a professional visual HTML & CSS editor that enables developers and designers to build responsive interfaces visually while generating clean, production-ready code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-surface-app font-ui text-fg-primary flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
