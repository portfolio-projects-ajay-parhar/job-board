import type { Metadata } from "next";
import { ProfileEditor } from "./profile-editor";
import { ResumeManager } from "./resume-manager";

export const metadata: Metadata = { title: "Your profile" };

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ProfileEditor />
        </div>
        <div className="lg:col-span-2">
          <ResumeManager />
        </div>
      </div>
    </div>
  );
}

