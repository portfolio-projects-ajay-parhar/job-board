import type { Metadata } from "next";
import { ApplicationsTracker } from "./applications-tracker";

export const metadata: Metadata = { title: "Your applications" };

export default function ApplicationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your applications</h1>
      <div className="mt-6">
        <ApplicationsTracker />
      </div>
    </div>
  );
}

