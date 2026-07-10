import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-950 dark:bg-black dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
