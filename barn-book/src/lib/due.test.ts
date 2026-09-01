import { describe, expect, it } from "vitest";
import {
  addDays,
  compareDueStates,
  computeNextDue,
  daysBetween,
  dueState,
  statusLabel,
  todayLocal,
} from "./due";

const TODAY = "2026-09-01";

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-09-01", 10)).toBe("2026-09-11");
  });
  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("is stable across US DST transitions (calendar days, not 24h blocks)", () => {
    // US spring-forward 2026-03-08, fall-back 2026-11-01
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    expect(addDays("2026-03-01", 365)).toBe("2027-03-01");
  });
  it("subtracts with negative days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("daysBetween", () => {
  it("is positive when b is later, negative when earlier", () => {
    expect(daysBetween("2026-09-01", "2026-09-11")).toBe(10);
    expect(daysBetween("2026-09-11", "2026-09-01")).toBe(-10);
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
  });
});

describe("computeNextDue", () => {
  it("adds the interval to the given date", () => {
    expect(computeNextDue("2026-09-01", 365)).toBe("2027-09-01");
    expect(computeNextDue("2026-09-01", 56)).toBe("2026-10-27");
  });
  it("recalculates from a backdated dose", () => {
    // Coggins logged today but given 100 days ago → due 265 days out.
    expect(computeNextDue("2026-05-24", 365)).toBe("2027-05-24");
  });
  it("returns null for one-time treatments", () => {
    expect(computeNextDue("2026-09-01", null)).toBeNull();
  });
});

describe("dueState", () => {
  it("never logged when there is no record", () => {
    const s = dueState(null, TODAY);
    expect(s.status).toBe("never");
    expect(statusLabel(s)).toBe("Never logged");
  });

  it("overdue when next_due is in the past, with day count", () => {
    const s = dueState({ given_on: "2025-08-01", next_due: "2026-08-22" }, TODAY);
    expect(s.status).toBe("overdue");
    expect(s.days).toBe(10);
    expect(statusLabel(s)).toBe("10 days overdue");
  });

  it("one day overdue reads singular", () => {
    const s = dueState({ given_on: "2025-08-31", next_due: "2026-08-31" }, TODAY);
    expect(s.days).toBe(1);
    expect(statusLabel(s)).toBe("1 day overdue");
  });

  it("due today counts as due soon, not overdue", () => {
    const s = dueState({ given_on: "2025-09-01", next_due: "2026-09-01" }, TODAY);
    expect(s.status).toBe("soon");
    expect(statusLabel(s)).toBe("Due today");
  });

  it("due soon within 30 days, current beyond", () => {
    expect(dueState({ given_on: "x" as string, next_due: "2026-10-01" }, TODAY).status).toBe("soon"); // 30 days
    expect(dueState({ given_on: "x" as string, next_due: "2026-10-02" }, TODAY).status).toBe("current"); // 31 days
  });

  it("history-only when next_due is null (one-time treatment)", () => {
    const s = dueState({ given_on: "2026-01-15", next_due: null }, TODAY);
    expect(s.status).toBe("none");
    expect(s.lastGiven).toBe("2026-01-15");
    expect(statusLabel(s)).toBe("No reminder");
  });
});

describe("compareDueStates", () => {
  it("sorts never > most overdue > soonest > current > none", () => {
    const never = dueState(null, TODAY);
    const veryOverdue = dueState({ given_on: "a", next_due: "2026-07-01" }, TODAY);
    const overdue = dueState({ given_on: "a", next_due: "2026-08-30" }, TODAY);
    const soon = dueState({ given_on: "a", next_due: "2026-09-10" }, TODAY);
    const later = dueState({ given_on: "a", next_due: "2026-09-20" }, TODAY);
    const current = dueState({ given_on: "a", next_due: "2027-01-01" }, TODAY);
    const none = dueState({ given_on: "a", next_due: null }, TODAY);

    const sorted = [current, soon, none, overdue, never, later, veryOverdue].sort(
      compareDueStates
    );
    expect(sorted).toEqual([never, veryOverdue, overdue, soon, later, current, none]);
  });
});

describe("todayLocal", () => {
  it("formats the local calendar date", () => {
    expect(todayLocal(new Date(2026, 8, 1, 23, 59))).toBe("2026-09-01");
    expect(todayLocal(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
});
