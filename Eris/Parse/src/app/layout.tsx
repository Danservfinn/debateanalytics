import type { Metadata } from "next";
import { Inter, Playfair_Display, Source_Serif_4 } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/layout/navbar";
import "./globals.css";

// Body text - Clean, readable sans-serif
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Headlines & Masthead - Authoritative serif
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

// Body serif for articles - Readable long-form
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parse | Critical Media Analysis",
  description: "Rigorous news analysis that steel-mans perspectives, detects manipulation, and quantifies truth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${sourceSerif.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <SessionProvider>
          <div className="min-h-screen flex flex-col texture-newsprint">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
