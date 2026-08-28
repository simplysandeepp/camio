import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camio",
  description: "Self-hosted, login-protected security camera.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
