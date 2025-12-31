import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Debate Analytics | Reddit Argument Analysis",
  description: "Analyze Reddit debates with AI-powered argument quality metrics, fallacy detection, and per-user statistics.",
  keywords: ["debate", "analytics", "reddit", "arguments", "fallacy", "analysis"],
  authors: [{ name: "Debate Analytics" }],
  openGraph: {
    title: "Debate Analytics",
    description: "AI-powered Reddit debate analysis",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <div className="bg-mesh-gradient fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
