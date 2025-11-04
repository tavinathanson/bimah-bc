import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
