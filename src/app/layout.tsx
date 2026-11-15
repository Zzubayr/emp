import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EMP · EMSS Mentorship Platform", template: "%s · EMP" },
  description: "One home where every mentor and mentee knows who they are paired with, when they meet next, and whether it is helping.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e13" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
