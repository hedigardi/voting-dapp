import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { getContract, SEPOLIA_CHAIN_ID_HEX } from "../utils/web3";

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

const formatVoteCount = (count) => `${count} ${count === 1 ? "vote" : "votes"}`;

const deriveSessionStatus = ({ session, currentTime, candidateCount }) => {
  if (!session.isActive) return "Inactive";
  if (currentTime > Number(session.endTime)) return "Completed";
  if (currentTime < Number(session.startTime)) return "Not Started";
  if (candidateCount === 0) return "Not Ready";
  return "Active";
};

const getStatusTone = (status) => {
  if (status === "Completed") return "status-pill status-pill-done";
  if (status === "Active") return "status-pill status-pill-live";
  if (status === "Not Started") return "status-pill status-pill-upcoming";
  return "status-pill status-pill-neutral";
};

const PublicSessionPage = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    walletConnected,
    account,
    walletError,
    isWrongNetwork,
    connectWallet,
  } = useWallet();

  const numericSessionId = Number(sessionId);

  const handleError = (message) => {
    setError(message);
    setTimeout(() => setError(""), 3000);
  };

  const handleSessionError = (message) => {
    setSessionError(message);
    setTimeout(() => setSessionError(""), 4000);
  };

  const fetchSession = useCallback(async () => {
    if (Number.isNaN(numericSessionId) || numericSessionId < 0) {
      setSession(null);
      handleError("Invalid session link.");
      return;
    }

    try {
      setLoading(true);
      const contract = getContract();
      const sessionCount = Number(await contract.methods.sessionCount().call());

      if (numericSessionId >= sessionCount) {
        setSession(null);
        handleError("This voting session does not exist.");
        return;
      }

      const sessionData = await contract.methods
        .votingSessions(numericSessionId)
        .call();
      const candidates = await contract.methods
        .getCandidates(numericSessionId)
        .call();

      const currentTime = Math.floor(Date.now() / 1000);
      const status = deriveSessionStatus({
        session: sessionData,
        currentTime,
        candidateCount: candidates.length,
      });

      const hasVoted = account
        ? await contract.methods.hasUserVoted(numericSessionId, account).call()
        : false;

      let votedCandidateId = null;
      if (account && hasVoted) {
        const voteEvents = await contract.getPastEvents("VoteCast", {
          filter: { voter: account, sessionId: numericSessionId },
          fromBlock: 0,
          toBlock: "latest",
        });
        votedCandidateId =
          voteEvents.length > 0
            ? Number(voteEvents[voteEvents.length - 1].returnValues.candidateId)
            : null;
      }

      let winner = "";
      let isTie = false;
      if (status === "Completed" && candidates.length > 0) {
        try {
          const result = await contract.methods
            .getWinner(numericSessionId)
            .call();
          winner = result[0];
          isTie = result[1];
        } catch {
          winner = "";
          isTie = false;
        }
      }

      setSession({
        id: Number(sessionData.id),
        title: sessionData.title,
        startTime: Number(sessionData.startTime),
        endTime: Number(sessionData.endTime),
        status,
        hasVoted,
        votedCandidateId,
        winner,
        isTie,
        candidates: candidates.map((candidate, index) => ({
          id: index,
          name: candidate.name,
          votes: Number(candidate.voteCount),
        })),
      });
    } catch (err) {
      handleError("Failed to load voting session: " + err.message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [numericSessionId, account]);

  const voteForCandidate = async (candidateId) => {
    if (!session) return;

    try {
      setLoading(true);
      const contract = getContract();
      await contract.methods
        .vote(session.id, candidateId)
        .send({ from: account });
      await fetchSession();
    } catch (err) {
      handleSessionError("Failed to vote: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!walletConnected || !account || isWrongNetwork) {
      setSession(null);
      return;
    }

    fetchSession();
  }, [walletConnected, account, isWrongNetwork, fetchSession]);

  useEffect(() => {
    if (walletError) {
      handleError(walletError);
    }
  }, [walletError]);

  return (
    <div className="container page-shell">
      <section className="page-hero page-hero-voting">
        <div>
          <p className="page-kicker">You're invited to vote</p>
          <h1 className="page-title">Cast your vote on this session.</h1>
          <p className="page-subtitle">
            Someone has invited you to participate in this private voting
            session. Vote while it's active and check the results after it
            closes.
          </p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">Voting session</span>
            <strong>
              #{Number.isNaN(numericSessionId) ? "-" : numericSessionId + 1}
            </strong>
            <span className="summary-footnote">Exclusive invitation</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Your role</span>
            <strong>Participant</strong>
            <span className="summary-footnote">Vote and view results</span>
          </div>
        </div>
      </section>

      {loading && (
        <div className="app-loading-overlay" role="status" aria-live="polite">
          <div className="app-loading-card">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>Syncing this session from on-chain data...</p>
          </div>
        </div>
      )}

      {!walletConnected ? (
        <section className="connect-panel">
          <div>
            <p className="page-kicker">Wallet required</p>
            <h2>Connect your wallet to access this session.</h2>
            <p>
              You need a wallet connection to read this session state and cast a
              vote securely on Sepolia.
            </p>
          </div>
          <div className="connect-panel-side">
            <button
              className="btn btn-primary btn-lg app-cta"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
            <p className="connect-panel-note">
              Use any wallet supported by your browser extension.
            </p>
          </div>
        </section>
      ) : (
        <>
          {error && <div className="alert alert-danger">{error}</div>}

          {isWrongNetwork && (
            <div className="alert alert-warning">
              Switch wallet network to Sepolia ({SEPOLIA_CHAIN_ID_HEX}) to use
              this session link.
            </div>
          )}

          {!session ? (
            <section className="empty-state-panel">
              <h3>Session unavailable</h3>
              <p>
                This link may be invalid, or the session is not accessible from
                the connected wallet/network state.
              </p>
            </section>
          ) : (
            <section className="session-grid">
              <article className="session-card">
                <div className="session-card-top">
                  <div>
                    <p className="session-eyebrow">Session #{session.id + 1}</p>
                    <h3>{session.title}</h3>
                  </div>
                  <span className={getStatusTone(session.status)}>
                    {session.status}
                  </span>
                </div>

                <div className="session-meta-grid">
                  <div>
                    <span className="wallet-label">Starts</span>
                    <strong>{formatTimestamp(session.startTime)}</strong>
                  </div>
                  <div>
                    <span className="wallet-label">Ends</span>
                    <strong>{formatTimestamp(session.endTime)}</strong>
                  </div>
                  <div>
                    <span className="wallet-label">Candidates</span>
                    <strong>{session.candidates.length}</strong>
                  </div>
                </div>

                {session.status !== "Completed" && session.hasVoted ? (
                  <div className="vote-confirmation" role="status">
                    <span className="vote-confirmation-label">
                      Vote confirmed
                    </span>
                    <strong className="vote-confirmation-text">
                      Your vote has already been recorded for this session.
                    </strong>
                  </div>
                ) : null}

                <div className="candidate-stack">
                  {session.candidates.map((candidate) => {
                    if (session.status === "Completed") {
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
                    }

                    return (
                      <div
                        className={`candidate-row ${
                          session.hasVoted &&
                          candidate.id === session.votedCandidateId
                            ? "candidate-row-voted"
                            : ""
                        }`}
                        key={candidate.id}
                      >
                        <div>
                          <strong>{candidate.name}</strong>
                        </div>
                        {session.hasVoted ? (
                          candidate.id === session.votedCandidateId ? (
                            <span
                              className="candidate-choice-badge"
                              role="img"
                              aria-label="Your selected candidate"
                              title="Your selected candidate"
                            >
                              <svg
                                className="candidate-choice-icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M9.2 16.4L4.8 12l1.4-1.4 3 3 8.6-8.6 1.4 1.4z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                          ) : null
                        ) : session.status === "Active" ? (
                          <button
                            className="btn btn-primary session-action"
                            onClick={() => voteForCandidate(candidate.id)}
                            disabled={isWrongNetwork}
                          >
                            Vote now
                          </button>
                        ) : (
                          <span className="candidate-state">
                            {session.status === "Not Started"
                              ? "Opens soon"
                              : "Read only"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {sessionError && (
                  <div className="admin-feedback-inline" aria-live="polite">
                    <div
                      className="admin-feedback-toast admin-feedback-toast-error"
                      role="alert"
                    >
                      <span className="admin-feedback-label">
                        Action required
                      </span>
                      <strong className="admin-feedback-message">
                        {sessionError}
                      </strong>
                    </div>
                  </div>
                )}

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
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default PublicSessionPage;
