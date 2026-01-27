import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "Reading Knowledge Base",
  description: "Your personal reading notes and knowledge system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}