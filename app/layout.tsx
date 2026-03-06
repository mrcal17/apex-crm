import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./components/Toast";
import ThemeToggle from "./components/ThemeToggle";
import AuthProvider from "./components/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GoyCattleHerder CRM",
  description: "Construction project management & commission tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${mono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider>
            {children}
            <ThemeToggle />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
