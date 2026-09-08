"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";

export function VerifyButton({ id, isVerified }: { id: string; isVerified: boolean }) {
  const router = useRouter();
  const { toast } = useToast();

  async function toggle() {
    try {
      await axios.patch(`/api/admin/companies/${id}`, { isVerified: !isVerified });
      toast(isVerified ? "Company unverified" : "Company verified", "success");
      router.refresh();
    } catch {
      toast("Action failed", "error");
    }
  }

  return (
    <button
      onClick={toggle}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        isVerified
          ? "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          : "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      }`}
    >
      {isVerified ? "Unverify" : "Verify"}
    </button>
  );
}
