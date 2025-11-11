import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/ui/Footer";
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: "Bimah - Analytics for Synagogues",
  description: "Privacy-first analytics and insights for synagogues",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased flex flex-col min-h-screen font-sans">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
