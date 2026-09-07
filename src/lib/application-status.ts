import { ApiError } from "./api-error";

/**
 * Application status machine (server-authoritative).
 *
 * Employer flow (strictly forward, no skips):
 *   SUBMITTED → IN_REVIEW → INTERVIEW → OFFER → HIRED
 * REJECTED from any live stage. WITHDRAWN by the candidate from any live
 * stage before HIRED. Terminal: HIRED, REJECTED, WITHDRAWN.
 */

export const APPLICATION_FLOW = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED"] as const;

const TERMINAL = new Set(["HIRED", "REJECTED", "WITHDRAWN"]);

export type ApplicationStatusName =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "INTERVIEW"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export function canTransitionApplication(from: string, to: string): boolean {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  if (to === "REJECTED") return true; // any live stage → REJECTED
  if (to === "WITHDRAWN") return from !== "HIRED"; // candidate withdraw until HIRED
  const i = APPLICATION_FLOW.indexOf(from as never);
  const j = APPLICATION_FLOW.indexOf(to as never);
  if (i === -1 || j === -1) return false;
  return j === i + 1; // strictly forward, no skips
}

/** Throws 422 INVALID_TRANSITION including the current status for UI recovery. */
export function assertApplicationTransition(from: string, to: string): void {
  if (!canTransitionApplication(from, to)) {
    throw new ApiError(
      422,
      `Cannot move application from ${from} to ${to} (current status: ${from})`,
      "INVALID_TRANSITION",
    );
  }
}

/** Machine-legal next statuses for the employer UI (forward step + REJECTED). */
export function employerLegalNext(from: string): string[] {
  const next: string[] = [];
  const i = APPLICATION_FLOW.indexOf(from as never);
  if (i !== -1 && i + 1 < APPLICATION_FLOW.length) next.push(APPLICATION_FLOW[i + 1]);
  if (from !== "HIRED" && from !== "REJECTED") next.push("REJECTED");
  return next;
}

export const isTerminalApplicationStatus = (status: string): boolean => TERMINAL.has(status);
