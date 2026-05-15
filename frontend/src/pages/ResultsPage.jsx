import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  getContract,
  CHAIN_NAME,
  sortSessionsByRecency,
  switchToSupportedNetwork,
} from "../utils/web3";

const formatTimestamp = (timestamp) => {
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

const formatSyncTime = (timestampMs) => {
  if (!timestampMs) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(navigator.language || "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestampMs));
};

const formatVoteCount = (count) => `${count} ${count === 1 ? "vote" : "votes"}`;

const deriveSessionStatus = ({ session, currentTime, candidateCount }) => {
  if (!session.isActive) return "Inactive";
  if (currentTime > Number(session.endTime)) return "Completed";
  if (currentTime < Number(session.startTime)) return "Not Started";
  if (candidateCount === 0) return "Not Ready";
  return "Active";
};

const getStatusTone = (status) => {
  if (status === "Completed") {
    return "status-pill status-pill-done";
  }

  if (status === "Active") {
    return "status-pill status-pill-live";
  }

  if (status === "Not Started") {
    return "status-pill status-pill-upcoming";
  }

  if (status === "Not Ready") {
    return "status-pill status-pill-neutral";
  }

  return "status-pill status-pill-neutral";
};

/**
 * ResultsPage component displays the results of completed voting sessions.
 */
const ResultsPage = () => {
  // State variables
  const [sessions, setSessions] = useState([]); // Stores fetched voting sessions
  const [error, setError] = useState(""); // For displaying error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for displaying the spinner
  const {
    walletConnected,
    account,
    hasResolvedChainId,
    walletError,
    isWrongNetwork,
    connectWallet,
  } = useWallet();

  const handleNetworkSwitch = async () => {
    try {
      await switchToSupportedNetwork();
    } catch (err) {
      setError(err.message || `Failed to switch to ${CHAIN_NAME}.`);
    }
  };

  /**
   * Fetches voting results for all sessions from the smart contract.
   */
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract();

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
    if (!walletConnected || !account || !hasResolvedChainId || isWrongNetwork) {
      setSessions([]);
      return;
    }

    fetchResults();
  }, [
    walletConnected,
    account,
    hasResolvedChainId,
    isWrongNetwork,
    fetchResults,
  ]);

  useEffect(() => {
    if (!walletConnected || !account || !hasResolvedChainId || isWrongNetwork) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchResults();
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [
    walletConnected,
    account,
    hasResolvedChainId,
    isWrongNetwork,
    fetchResults,
  ]);

  useEffect(() => {
    if (walletError) {
      setError(walletError);
    }
  }, [walletError]);

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

      {!walletConnected ? (
        <section className="connect-panel">
          <div>
            <p className="page-kicker">Viewer access</p>
            <h2>Connect a wallet to inspect session outcomes.</h2>
            <p>
              Result cards are loaded from the contract and reflect the same
              data any observer can verify on Sepolia.
            </p>
          </div>
          <div className="connect-panel-side">
            <button
              className="btn btn-primary btn-lg app-cta"
              onClick={connectWallet}
            >
              <svg
                className="app-wallet-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <path d="M1 10h22" />
                <rect x="16" y="14" width="4" height="4" rx="1" />
              </svg>
              Connect Wallet
            </button>
          </div>
        </section>
      ) : (
        <>
          {error && <div className="alert alert-danger">{error}</div>}

          {isWrongNetwork && (
            <div className="alert alert-warning">
              Your wallet is connected to the wrong network. Please switch to{" "}
              {CHAIN_NAME} to view results.
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleNetworkSwitch}
                >
                  Switch to {CHAIN_NAME}
                </button>
              </div>
            </div>
          )}

          {sessions.length > 0 ? (
            <section className="session-grid">
              {sessions.map((session) => (
                <article className="session-card" key={session.id}>
                  <div className="session-card-top">
                    <div>
                      <p className="session-eyebrow">
                        Session #{session.id + 1}
                      </p>
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
                            <span
                              className="results-bar-fill"
                              style={{ width }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {session.status === "Completed" &&
                    (() => {
                      const isNoCandidates = session.candidates.length === 0;
                      const isTie = !isNoCandidates && session.isTie;

                      const toneClass = isNoCandidates
                        ? "results-outcome-banner-empty"
                        : isTie
                          ? "results-outcome-banner-tie"
                          : "results-outcome-banner-winner";

                      const label = isNoCandidates
                        ? "No candidates"
                        : isTie
                          ? "Tie detected"
                          : "Winner";

                      const value = isNoCandidates
                        ? "No candidates available"
                        : isTie
                          ? "No clear winner"
                          : session.winner;

                      return (
                        <div
                          className={`results-outcome-banner ${toneClass}`}
                          role="status"
                        >
                          <span className="results-outcome-label">{label}</span>
                          <strong className="results-outcome-value">
                            {value}
                          </strong>
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
                Completed, upcoming, and live sessions will appear here after
                the contract reports them.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;
