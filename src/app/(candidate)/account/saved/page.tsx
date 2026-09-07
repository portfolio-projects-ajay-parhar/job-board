import type { Metadata } from "next";
import { SavedJobsList } from "./saved-jobs-list";

export const metadata: Metadata = { title: "Saved jobs" };

export default function SavedJobsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Saved jobs</h1>
      <div className="mt-6">
        <SavedJobsList />
      </div>
    </div>
  );
}

