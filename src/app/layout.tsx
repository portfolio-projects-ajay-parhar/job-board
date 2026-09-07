import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
