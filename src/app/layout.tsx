import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "BetterNotes Admin",
  description: "Internal control panel for BetterNotes admins",
  icons: {
    icon: "/logo-circle.svg",
    shortcut: "/logo-circle.svg",
    apple: "/logo-circle.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
