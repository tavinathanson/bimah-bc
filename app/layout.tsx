import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "Bimah: Beth Chaim - Pledge Analytics",
  description: "Synagogue pledge analytics and reporting for Beth Chaim",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
