import { describe, it, expect } from "vitest";
import { formatSalary, parseSalaryToCents, toYearlyCents, toMonthlyCents } from "./salary";

describe("formatSalary", () => {
  it("formats a full range with /yr suffix", () => {
    expect(formatSalary(12000000, 16000000, "YEAR")).toBe("$120,000 – $160,000/yr");
  });

  it("formats hourly salaries with /hr suffix", () => {
    expect(formatSalary(2500, 5000, "HOUR")).toBe("$25 – $50/hr");
  });

  it("formats a single bound", () => {
    expect(formatSalary(10000000, null, "YEAR")).toBe("$100,000/yr");
    expect(formatSalary(null, 8000000, "MONTH")).toBe("$80,000/month");
  });

  it("returns a fallback when salary is undisclosed", () => {
    expect(formatSalary(undefined, undefined, "YEAR")).toBe("Salary not disclosed");
    expect(formatSalary(null, null, "YEAR")).toBe("Salary not disclosed");
  });
});

describe("parseSalaryToCents", () => {
  it("parses plain numbers to cents", () => {
    expect(parseSalaryToCents("120000")).toBe(12000000);
  });

  it("strips formatting characters", () => {
    expect(parseSalaryToCents("$120,000.50")).toBe(12000050);
  });

  it("rounds to the nearest cent", () => {
    expect(parseSalaryToCents("10.999")).toBe(1100);
  });

  it("throws on invalid input", () => {
    expect(() => parseSalaryToCents("abc")).toThrow();
    expect(() => parseSalaryToCents("-5")).toThrow();
  });
});

describe("salary normalization", () => {
  it("normalizes hourly to yearly correctly (2080 hours/year)", () => {
    expect(toYearlyCents(5000, "HOUR")).toBe(10400000); // $50/hr → $104,000/yr
  });

  it("normalizes weekly (52 weeks) and daily (260 days)", () => {
    expect(toYearlyCents(200000, "WEEK")).toBe(10400000); // $2,000/wk → $104,000/yr
    expect(toYearlyCents(40000, "DAY")).toBe(10400000); // $400/day → $104,000/yr
  });

  it("leaves yearly salaries unchanged", () => {
    expect(toYearlyCents(12000000, "YEAR")).toBe(12000000);
  });

  it("computes monthly equivalents", () => {
    expect(toMonthlyCents(12000000, "YEAR")).toBe(1000000);
  });
});
