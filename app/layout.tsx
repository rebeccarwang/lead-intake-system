import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Get in touch",
  description: "Lead capture form",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
