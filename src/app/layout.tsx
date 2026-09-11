import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
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
  title: {
    default: "JobBoard — Find your next role",
    template: "%s · JobBoard",
  },
  description:
    "A two-sided job marketplace: search jobs with full-text search, apply with your resume, and manage the hiring pipeline.",
  openGraph: {
    title: "JobBoard — Find your next role",
    description: "Search thousands of jobs from verified companies.",
    type: "website",
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            © {new Date().getFullYear()} JobBoard — built with Next.js, Prisma &amp; PostgreSQL
          </footer>
        </Providers>
      </body>
    </html>
  );
}
