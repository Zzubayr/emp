import type { Metadata, Viewport } from "next";
import { Allura, Hanken_Grotesk, Unbounded } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Brand fonts are Tomato Grotesk and Monument Extended (licensed). These are the closest free
// matches; drop the licensed files into next/font/local here when the society has them.
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--ff-body", display: "swap" });
const display = Unbounded({ subsets: ["latin"], variable: "--ff-display", weight: ["500", "600", "700"], display: "swap" });
const script = Allura({ subsets: ["latin"], variable: "--ff-script", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: { default: "EMSS Mentorship", template: "%s · EMSS Mentorship" },
  description: "One home where every mentor and mentee knows who they are paired with, when they meet next, and whether it is helping.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${body.variable} ${display.variable} ${script.variable}`} lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
