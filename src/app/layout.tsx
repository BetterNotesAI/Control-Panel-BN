import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "BetterNotes Admin",
  description: "Internal control panel for BetterNotes admins",
  icons: {
    icon: "/icon.png?v=3",
    shortcut: "/icon.png?v=3",
    apple: "/apple-icon.png?v=3",
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
