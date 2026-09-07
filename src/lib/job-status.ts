import { ApiError } from "./api-error";

/**
 * Job status machine (server-authoritative):
 *   DRAFT → PUBLISHED        (sets publishedAt)
 *   PUBLISHED → CLOSED       (sets closesAt)
 *   CLOSED → PUBLISHED       (reopen — allowed)
 *   any → ARCHIVED           (terminal soft-delete)
 */
export const JOB_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["CLOSED", "ARCHIVED"],
  CLOSED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionJob(from: string, to: string): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws 422 INVALID_TRANSITION (with the current status) on illegal moves. */
export function assertJobTransition(from: string, to: string): void {
  if (!canTransitionJob(from, to)) {
    throw new ApiError(422, `Cannot move job from ${from} to ${to}`, "INVALID_TRANSITION");
  }
}

/** Machine-legal target states for a given status (drives UI buttons). */
export function jobStatusActions(status: string): string[] {
  return JOB_TRANSITIONS[status] ?? [];
}
