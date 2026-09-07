import type { Metadata } from "next";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Edit job</h1>
      <div className="mt-6">
        <JobForm jobId={id} />
      </div>
    </div>
  );
}
