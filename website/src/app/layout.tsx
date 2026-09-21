import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import AuthSync from "@/components/AuthSync";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AstraVeda — Cosmic Intelligence for a Better You",
  description:
    "AI-Powered Astrology. Ancient Wisdom. A Better You. Discover your future, understand your karmas, and unlock life's opportunities with AstraVeda.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      localization={{
        signIn: {
          start: {
            title: "Sign in",
            subtitle: "Use your email or a connected account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Takes less than a minute",
          },
        },
      }}
    >
      <html
        lang="en"
        className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <I18nProvider>
            <AuthSync />
            {children}
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
