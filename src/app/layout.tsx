import type { Metadata } from "next";
import "./globals.css";

import Link from "next/link";
import { UploadCloud, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Briefly - 회의록 분석",
  description: "사내 회의록 분석 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white font-sans selection:bg-fuchsia-500 selection:text-white flex flex-col">
        <header className="px-8 py-6 w-full border-b border-white/10 backdrop-blur-md bg-white/5 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-2 rounded-xl shadow-lg group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Briefly</h1>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/archives" className="flex items-center gap-2 text-sm font-medium text-purple-200 hover:text-white transition-colors">
                <Database className="w-4 h-4" />
                회의록 보관소
              </Link>
              <div className="text-sm font-medium text-purple-200 bg-purple-900/40 px-4 py-2 rounded-full ring-1 ring-purple-500/30 hidden sm:block">
                사내 회의록 분석
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
