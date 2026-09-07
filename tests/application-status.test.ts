import { describe, it, expect } from "vitest";
import {
  canTransitionApplication,
  assertApplicationTransition,
  employerLegalNext,
  isTerminalApplicationStatus,
} from "@/lib/application-status";

const STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

const LEGAL: [string, string][] = [
  // employer flow — strictly forward, one step
  ["SUBMITTED", "IN_REVIEW"],
  ["IN_REVIEW", "INTERVIEW"],
  ["INTERVIEW", "OFFER"],
  ["OFFER", "HIRED"],
  // REJECTED from any live stage
  ["SUBMITTED", "REJECTED"],
  ["IN_REVIEW", "REJECTED"],
  ["INTERVIEW", "REJECTED"],
  ["OFFER", "REJECTED"],
  // candidate withdraw from any live stage before HIRED
  ["SUBMITTED", "WITHDRAWN"],
  ["IN_REVIEW", "WITHDRAWN"],
  ["INTERVIEW", "WITHDRAWN"],
  ["OFFER", "WITHDRAWN"],
];

const ALL_PAIRS: [string, string][] = STATUSES.flatMap((from) =>
  STATUSES.map((to) => [from, to] as [string, string]),
);

describe("application status machine (7×7 table)", () => {
  it("accepts every legal transition", () => {
    for (const [from, to] of LEGAL) {
      expect(canTransitionApplication(from, to), `${from} → ${to} should be legal`).toBe(true);
      expect(() => assertApplicationTransition(from, to)).not.toThrow();
    }
  });

  it("rejects every illegal transition", () => {
    for (const [from, to] of ALL_PAIRS) {
      if (!LEGAL.some(([f, t]) => f === from && t === to)) {
        expect(canTransitionApplication(from, to), `${from} → ${to} should be illegal`).toBe(false);
        try {
          assertApplicationTransition(from, to);
          expect.unreachable(`${from} → ${to} should throw`);
        } catch (e) {
          expect((e as { status?: number }).status).toBe(422);
          expect((e as { code?: string }).code).toBe("INVALID_TRANSITION");
        }
      }
    }
  });

  it("no skips: SUBMITTED → INTERVIEW/OFFER/HIRED must fail", () => {
    expect(canTransitionApplication("SUBMITTED", "INTERVIEW")).toBe(false);
    expect(canTransitionApplication("SUBMITTED", "OFFER")).toBe(false);
    expect(canTransitionApplication("SUBMITTED", "HIRED")).toBe(false);
    expect(canTransitionApplication("IN_REVIEW", "OFFER")).toBe(false);
  });

  it("nothing leaves terminal states", () => {
    for (const from of ["HIRED", "REJECTED", "WITHDRAWN"]) {
      for (const to of STATUSES) {
        expect(canTransitionApplication(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it("no self-transitions", () => {
    for (const s of STATUSES) expect(canTransitionApplication(s, s)).toBe(false);
  });

  it("422 message carries the current status for UI recovery", () => {
    try {
      assertApplicationTransition("REJECTED", "IN_REVIEW");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("REJECTED");
    }
  });

  it("employerLegalNext offers the forward step + REJECTED only", () => {
    expect(employerLegalNext("SUBMITTED")).toEqual(["IN_REVIEW", "REJECTED"]);
    expect(employerLegalNext("IN_REVIEW")).toEqual(["INTERVIEW", "REJECTED"]);
    expect(employerLegalNext("OFFER")).toEqual(["HIRED", "REJECTED"]);
    expect(employerLegalNext("HIRED")).toEqual([]);
    expect(employerLegalNext("REJECTED")).toEqual([]);
  });

  it("terminal helper", () => {
    expect(isTerminalApplicationStatus("HIRED")).toBe(true);
    expect(isTerminalApplicationStatus("SUBMITTED")).toBe(false);
  });
});
