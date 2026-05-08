import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/queries";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExpenseDesk",
  description: "Simple expense management for small businesses",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // When Supabase is not configured, always show the sidebar (dev/demo mode).
  // When configured, the proxy has already validated auth and forwarded the
  // result as x-user-authenticated so we don't need a second Supabase call.
  let showSidebar = !isSupabaseConfigured();

  if (isSupabaseConfigured()) {
    const headersList = await headers();
    showSidebar = headersList.get("x-user-authenticated") === "1";
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground h-full">
        <div className="flex h-screen overflow-hidden">
          {showSidebar && <Sidebar />}
          <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
