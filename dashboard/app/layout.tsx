import type { ReactNode } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const amiri = localFont({
  src: [
    {
      path: "../public/fonts/Amiri_400Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Amiri_700Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: " بصائر القرآن الكريم | لوحة المحتوى",
  description: "لوحة محتوى بنفس اللغة البصرية لتطبيق  بصائر القرآن الكريم.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={amiri.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
