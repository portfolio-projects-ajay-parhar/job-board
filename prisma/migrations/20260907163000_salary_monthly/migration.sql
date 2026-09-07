-- Normalized monthly salary (generated) for the salary-range filter —
-- all offers compared on one scale regardless of SalaryPeriod.
ALTER TABLE "Job" ADD COLUMN "salaryMonthlyCents" int GENERATED ALWAYS AS (
  CASE "salaryPeriod"
    WHEN 'HOUR'  THEN COALESCE("salaryMaxCents", "salaryMinCents") * 8  * 260 / 12
    WHEN 'DAY'   THEN COALESCE("salaryMaxCents", "salaryMinCents") * 260 / 12
    WHEN 'WEEK'  THEN COALESCE("salaryMaxCents", "salaryMinCents") * 52  / 12
    WHEN 'MONTH' THEN COALESCE("salaryMaxCents", "salaryMinCents")
    WHEN 'YEAR'  THEN COALESCE("salaryMaxCents", "salaryMinCents") / 12
  END
) STORED;

CREATE INDEX "Job_salaryMonthly_idx" ON "Job" ("salaryMonthlyCents");
