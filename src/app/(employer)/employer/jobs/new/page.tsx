import type { Metadata } from "next";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "New job" };

export default function NewJobPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Post a new job</h1>
      <div className="mt-6">
        <JobForm />
      </div>
    </div>
  );
}
