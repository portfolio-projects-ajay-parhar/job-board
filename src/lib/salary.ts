import type { SalaryPeriod } from "@prisma/client";

// Hours worked per period — used to normalize every salary to one scale
// (all comparisons in the salary-range filter happen on yearly cents).
const PERIOD_HOURS: Record<SalaryPeriod, number> = {
  HOUR: 1,
  DAY: 8,
  WEEK: 40,
  MONTH: 173,
  YEAR: 2080,
};

/** Normalize any salary (in cents, any period) to yearly cents. */
export const toYearlyCents = (cents: number, period: SalaryPeriod): number =>
  Math.round(cents * (PERIOD_HOURS.YEAR / PERIOD_HOURS[period]));

/** Normalize any salary (in cents, any period) to monthly cents. */
export const toMonthlyCents = (cents: number, period: SalaryPeriod): number =>
  Math.round(toYearlyCents(cents, period) / 12);

const formatCents = (cents: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const periodSuffix = (period: SalaryPeriod): string =>
  period === "YEAR" ? "/yr" : period === "HOUR" ? "/hr" : `/${period.toLowerCase()}`;

/** Human-readable salary range, e.g. "$120,000 – $160,000/yr". */
export const formatSalary = (
  minCents?: number | null,
  maxCents?: number | null,
  period: SalaryPeriod = "YEAR",
): string => {
  if (!minCents && !maxCents) return "Salary not disclosed";
  const suffix = periodSuffix(period);
  if (minCents && maxCents) return `${formatCents(minCents)} – ${formatCents(maxCents)}${suffix}`;
  return `${formatCents((minCents ?? maxCents)!)}${suffix}`;
};

/** Parse a user-supplied dollar amount ("120,000.50") into integer cents. */
export const parseSalaryToCents = (input: string): number => {
  const raw = String(input).trim();
  if (raw.includes("-") || !/[0-9]/.test(raw)) throw new Error("invalid amount");
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid amount");
  return Math.round(n * 100);
};
