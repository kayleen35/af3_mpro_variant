import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Drug Discovery MVP",
  description: "Research decision-support platform MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
