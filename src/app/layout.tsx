import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KdsSessionProvider } from "@/features/auth/context/KdsSessionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KDS — Kitchen Display System",
  description: "Hệ thống hiển thị và điều phối chế biến bếp theo thời gian thực",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <KdsSessionProvider>{children}</KdsSessionProvider>
      </body>
    </html>
  );
}
