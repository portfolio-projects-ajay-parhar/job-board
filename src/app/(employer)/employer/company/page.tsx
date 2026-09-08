import type { Metadata } from "next";
import { CompanyEditor } from "./company-editor";

export const metadata: Metadata = { title: "Company profile" };

export default function CompanyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Company profile</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        This information appears on your job posts and public company page.
      </p>
      <div className="mt-6">
        <CompanyEditor />
      </div>
    </div>
  );
}

