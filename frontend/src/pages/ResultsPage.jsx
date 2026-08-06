import { useCallback, useEffect, useState } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { getReadOnlyContract, sortSessionsByRecency } from "../utils/web3";
import {
  deriveSessionStatus,
  formatSyncTime,
  formatTimestamp,
  formatVoteCount,
  getStatusTone,
} from "../utils/format";

/**
 * ResultsPage component displays the results of completed voting sessions.
 * Results are public contract reads, so no wallet connection is required.
 */
const ResultsPage = () => {
  useDocumentTitle("Results");
  // State variables
  const [sessions, setSessions] = useState([]); // Stores fetched voting sessions
  const [error, setError] = useState(""); // For displaying error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for displaying the spinner

  /**
   * Fetches voting results for all sessions from the smart contract.
   */
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getReadOnlyContract();

      const sessionCount = await contract.methods.sessionCount().call();

      const currentTime = Math.floor(Date.now() / 1000);
      const syncedAt = Date.now();
      const fetchedSessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const candidates = await contract.methods.getCandidates(i).call();
        const status = deriveSessionStatus({
          session,
          currentTime,
          candidateCount: candidates.length,
        });
        const isCompleted = status === "Completed";
        let winner = null;
        let isTie = false;

        // Fetch winner details if the session is completed
        if (isCompleted && candidates.length > 0) {
          try {
            const result = await contract.methods.getWinner(i).call();
            winner = result[0];
            isTie = result[1];
          } catch (error) {
            console.error(
              `Error fetching winner for session ${i}:`,
              error.message,
            );
          }
        }

        // Add session details to the array
        fetchedSessions.push({
          id: Number(session.id),
          title: session.title,
          startTime: Number(session.startTime),
          endTime: Number(session.endTime),
          status,
          syncedAt,
          winner: candidates.length > 0 ? winner : "No candidates",
          isTie: candidates.length > 0 && isTie,
          candidates: candidates.map((candidate, index) => ({
            id: index,
            name: candidate.name,
            votes: Number(candidate.voteCount),
          })),
        });
      }

      setSessions(sortSessionsByRecency(fetchedSessions)); // Update state with fetched sessions
    } catch (err) {
      console.error("Error fetching results:", err);
      setError("Could not load results. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchResults();
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [fetchResults]);

  const completedSessions = sessions.filter(
    (session) => session.status === "Completed",
  );
  const liveSessions = sessions.filter(
    (session) => session.status === "Active",
  );
  const tiedSessions = sessions.filter((session) => session.isTie);

  return (
    <div className="container page-shell">
      <section className="page-hero page-hero-results">
        <div>
          <p className="page-kicker">Outcome review</p>
          <h1 className="page-title">
            Read results like a live election dashboard.
          </h1>
          <p className="page-subtitle">
            Compare sessions, inspect candidate vote totals, and quickly spot
            ties or still-active polls without digging through raw contract
            data.
          </p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">Completed</span>
            <strong>{completedSessions.length}</strong>
            <span className="summary-footnote">Finalized sessions</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Live</span>
            <strong>{liveSessions.length}</strong>
            <span className="summary-footnote">Still receiving votes</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Ties</span>
            <strong>{tiedSessions.length}</strong>
            <span className="summary-footnote">Needs follow-up governance</span>
          </div>
        </div>
      </section>

      {loading && (
        <div className="app-loading-overlay" role="status" aria-live="polite">
          <div className="app-loading-card">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>Calculating current results from contract state...</p>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {sessions.length > 0 ? (
        <section className="session-grid">
          {sessions.map((session) => (
            <article className="session-card" key={session.id}>
              <div className="session-card-top">
                <div>
                  <p className="session-eyebrow">Session #{session.id + 1}</p>
                  <h3>{session.title}</h3>
                </div>
                <span className={getStatusTone(session.status)}>
                  {session.status}
                </span>
              </div>

              <div className="session-sync-meta">
                <span className="session-sync-badge">
                  <span className="session-sync-dot" aria-hidden="true" />
                  Last updated: {formatSyncTime(session.syncedAt)}
                </span>
              </div>

              <div className="session-meta-grid">
                <div>
                  <span className="wallet-label">Start</span>
                  <strong>{formatTimestamp(session.startTime)}</strong>
                </div>
                <div>
                  <span className="wallet-label">End</span>
                  <strong>{formatTimestamp(session.endTime)}</strong>
                </div>
                <div>
                  <span className="wallet-label">Candidates</span>
                  <strong>{session.candidates.length}</strong>
                </div>
              </div>

              <div className="candidate-stack">
                {session.candidates.map((candidate) => {
                  const topVotes = Math.max(
                    ...session.candidates.map((entry) => entry.votes),
                    1,
                  );
                  const width = `${Math.max(
                    (candidate.votes / topVotes) * 100,
                    candidate.votes > 0 ? 12 : 0,
                  )}%`;

                  return (
                    <div className="results-row" key={candidate.id}>
                      <div className="results-row-head">
                        <strong>{candidate.name}</strong>
                        <span className="candidate-meta">
                          {formatVoteCount(candidate.votes)}
                        </span>
                      </div>
                      <div className="results-bar-track">
                        <span className="results-bar-fill" style={{ width }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {session.status === "Completed" &&
                (() => {
                  const isNoCandidates = session.candidates.length === 0;
                  const isTie = !isNoCandidates && session.isTie;
                  const hasNoVotes =
                    !isNoCandidates &&
                    session.candidates.length > 0 &&
                    session.candidates.reduce(
                      (sum, candidate) => sum + Number(candidate.votes),
                      0,
                    ) === 0;

                  const toneClass =
                    isNoCandidates || hasNoVotes
                      ? "results-outcome-banner-empty"
                      : isTie
                        ? "results-outcome-banner-tie"
                        : "results-outcome-banner-winner";

                  const label = isNoCandidates
                    ? "No candidates"
                    : hasNoVotes
                      ? "No votes"
                      : isTie
                        ? "Tie detected"
                        : "Winner";

                  const value = isNoCandidates
                    ? "No candidates available"
                    : hasNoVotes
                      ? "No votes cast yet"
                      : isTie
                        ? "No clear winner"
                        : session.winner;

                  return (
                    <div
                      className={`results-outcome-banner ${toneClass}`}
                      role="status"
                    >
                      <span className="results-outcome-label">{label}</span>
                      <strong className="results-outcome-value">{value}</strong>
                    </div>
                  );
                })()}
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state-panel">
          <h3>No result data available yet</h3>
          <p>
            Completed, upcoming, and live sessions will appear here after the
            contract reports them.
          </p>
        </section>
      )}
    </div>
  );
};

export default ResultsPage;
