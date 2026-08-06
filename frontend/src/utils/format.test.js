import { describe, expect, it } from "vitest";
import {
  deriveSessionStatus,
  formatSyncTime,
  formatTimestamp,
  formatVoteCount,
  getStatusTone,
  toSafeNumber,
} from "./format";

describe("toSafeNumber", () => {
  it("parses numbers and numeric strings", () => {
    expect(toSafeNumber(42)).toBe(42);
    expect(toSafeNumber("7")).toBe(7);
  });

  it("returns 0 for non-numeric input", () => {
    expect(toSafeNumber("abc")).toBe(0);
    expect(toSafeNumber(undefined)).toBe(0);
    expect(toSafeNumber(null)).toBe(0);
    expect(toSafeNumber(Number.NaN)).toBe(0);
  });
});

describe("formatVoteCount", () => {
  it("singularizes 1", () => {
    expect(formatVoteCount(1)).toBe("1 vote");
  });

  it("pluralizes everything else", () => {
    expect(formatVoteCount(0)).toBe("0 votes");
    expect(formatVoteCount(5)).toBe("5 votes");
  });
});

describe("deriveSessionStatus", () => {
  const baseSession = { isActive: true, startTime: "1000", endTime: "2000" };

  it("returns Inactive for inactive sessions", () => {
    expect(
      deriveSessionStatus({
        session: { ...baseSession, isActive: false },
        currentTime: 1500,
        candidateCount: 1,
      }),
    ).toBe("Inactive");
  });

  it("returns Completed after the end time", () => {
    expect(
      deriveSessionStatus({
        session: baseSession,
        currentTime: 2001,
        candidateCount: 1,
      }),
    ).toBe("Completed");
  });

  it("returns Not Started before the start time", () => {
    expect(
      deriveSessionStatus({
        session: baseSession,
        currentTime: 999,
        candidateCount: 1,
      }),
    ).toBe("Not Started");
  });

  it("returns Not Ready when there are no candidates", () => {
    expect(
      deriveSessionStatus({
        session: baseSession,
        currentTime: 1500,
        candidateCount: 0,
      }),
    ).toBe("Not Ready");
  });

  it("returns Active during the voting period", () => {
    expect(
      deriveSessionStatus({
        session: baseSession,
        currentTime: 1500,
        candidateCount: 2,
      }),
    ).toBe("Active");
  });
});

describe("getStatusTone", () => {
  it("maps known statuses to the correct pill classes", () => {
    expect(getStatusTone("Active")).toBe("status-pill status-pill-live");
    expect(getStatusTone("Not Started")).toBe(
      "status-pill status-pill-upcoming",
    );
    expect(getStatusTone("Completed")).toBe("status-pill status-pill-done");
    expect(getStatusTone("Not Ready")).toBe(
      "status-pill status-pill-neutral",
    );
    expect(getStatusTone("Inactive")).toBe("status-pill status-pill-neutral");
  });
});

describe("formatSyncTime", () => {
  it("falls back to --:-- without a timestamp", () => {
    expect(formatSyncTime(0)).toBe("--:--");
    expect(formatSyncTime(undefined)).toBe("--:--");
  });

  it("formats a valid timestamp as HH:MM", () => {
    const result = formatSyncTime(new Date(2024, 0, 1, 9, 5).getTime());
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatTimestamp", () => {
  it("returns a date and time string with a newline separator", () => {
    const result = formatTimestamp(1704067200); // 2024-01-01T00:00:00Z
    expect(result).toContain("\n");
  });
});
