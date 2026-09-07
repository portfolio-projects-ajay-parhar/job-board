"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";

export function JobModerationButtons({
  id,
  featured,
  status,
}: {
  id: string;
  featured: boolean;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  async function patch(body: Record<string, unknown>, message: string) {
    try {
      await axios.patch(`/api/admin/jobs/${id}`, body);
      toast(message, "success");
      router.refresh();
    } catch (err) {
      const message2 = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Action failed"
        : "Action failed";
      toast(message2, "error");
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => patch({ featured: !featured }, featured ? "Removed from featured" : "Job featured")}
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          featured ? "bg-amber-100 text-amber-700" : "border border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
      >
        {featured ? "★ Unfeature" : "☆ Feature"}
      </button>
      {status !== "CLOSED" && (
        <button
          onClick={() => patch({ close: true }, "Job closed")}
          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          Close
        </button>
      )}
    </div>
  );
}
