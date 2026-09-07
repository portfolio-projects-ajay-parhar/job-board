import type { Metadata } from "next";
import Link from "next/link";
import { JobsTable } from "./jobs-table";

export const metadata: Metadata = { title: "Your job posts" };

export default function EmployerJobsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your job posts</h1>
        <Link
          href="/employer/jobs/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + New job
        </Link>
      </div>
      <div className="mt-6">
        <JobsTable />
      </div>
    </div>
  );
}

