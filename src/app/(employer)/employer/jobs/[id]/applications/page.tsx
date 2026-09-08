import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PipelineBoard } from "./pipeline-board";

export const metadata: Metadata = { title: "Hiring pipeline" };

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: { title: true, slug: true, status: true },
  });

  return (
    <div>
      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/employer/jobs" className="hover:underline">
          Your job posts
        </Link>
        {" / "}
        <span>{job?.title ?? "Job"}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Pipeline — {job?.title ?? "Job"}
        </h1>
        <Link href={`/jobs/${job?.slug ?? ""}`} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          View public posting →
        </Link>
      </div>
      <div className="mt-6">{job ? <PipelineBoard jobId={id} /> : <p className="text-sm text-slate-500 dark:text-slate-400">Job not found.</p>}</div>
    </div>
  );
}
