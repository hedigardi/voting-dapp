/**
 * Shared presentation helpers for session cards and results views.
 * Centralized here so status logic and formatting are consistent across
 * the Admin, Voting, Results, and Public session pages.
 */

export const toSafeNumber = (value) => {
  try {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

/**
 * Formats a Unix timestamp (seconds) as a date + time string.
 * The "\n" is intentional — rendered as a line break via
 * `.session-meta-grid strong { white-space: pre-wrap; }`.
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const formatter = new Intl.DateTimeFormat(navigator.language || "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(navigator.language || "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const dateStr = formatter.format(date);
  const timeStr = timeFormatter.format(date);
  return `${dateStr}\n${timeStr}`;
};

export const formatSyncTime = (timestampMs) => {
  if (!timestampMs) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(navigator.language || "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestampMs));
};

export const formatVoteCount = (count) => {
  const voteCount = toSafeNumber(count);
  return `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
};

export const deriveSessionStatus = ({
  session,
  currentTime,
  candidateCount,
}) => {
  if (!session.isActive) return "Inactive";
  if (currentTime > Number(session.endTime)) return "Completed";
  if (currentTime < Number(session.startTime)) return "Not Started";
  if (candidateCount === 0) return "Not Ready";
  return "Active";
};

export const getStatusTone = (status) => {
  if (status === "Active") return "status-pill status-pill-live";
  if (status === "Not Started") return "status-pill status-pill-upcoming";
  if (status === "Completed") return "status-pill status-pill-done";
  return "status-pill status-pill-neutral";
};
