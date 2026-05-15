import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  assertCanSendTransaction,
  cacheVotedCandidate,
  clearPendingVotedCandidate,
  getContract,
  getCachedVotedCandidate,
  getPendingVotedCandidate,
  getRecommendedSendOptions,
  isReplacementUnderpricedError,
  resolveVotedCandidateFromEvents,
  setPendingVotedCandidate,
  sortSessionsByRecency,
  CHAIN_NAME,
  checkPassportIsHuman,
  parseWeb3ErrorMessage,
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

const getVotedCandidatesBySession = async (
  contract,
  account,
  sessionIds = [],
) => {
  const fallback = {};
  sessionIds.forEach((sessionId) => {
    const cachedCandidateId = getCachedVotedCandidate(sessionId, account);
    if (cachedCandidateId !== null) {
      fallback[Number(sessionId)] = cachedCandidateId;
    }
  });

  try {
    const voteEvents = await contract.getPastEvents("VoteCast", {
      filter: { voter: account },
      fromBlock: 0,
      toBlock: "latest",
    });

    return voteEvents.reduce(
      (acc, event) => {
        const sessionId = Number(event.returnValues.sessionId);
        const candidateId = Number(event.returnValues.candidateId);
        cacheVotedCandidate(sessionId, account, candidateId);
        acc[sessionId] = candidateId;
        return acc;
      },
      { ...fallback },
    );
  } catch (err) {
    console.error("Failed to resolve voted candidates from events:", err);
    return fallback;
  }
};

const deriveSessionStatus = ({ session, currentTime, candidateCount }) => {
  if (!session.isActive) return "Inactive";
  if (currentTime > Number(session.endTime)) return "Completed";
  if (currentTime < Number(session.startTime)) return "Not Started";
  if (candidateCount === 0) return "Not Ready";
  return "Active";
};

const getStatusTone = (status) => {
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
 * VotingPage component allows users to view active voting sessions and cast votes.
 */
const VotingPage = () => {
  // State variables
  const [sessions, setSessions] = useState([]); // Stores fetched voting sessions
  const [error, setError] = useState(""); // For displaying error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for displaying the spinner
  const [loadingContext, setLoadingContext] = useState("sessions"); // 'sessions' | 'voting'
  const [sessionErrors, setSessionErrors] = useState({}); // Store errors per session
  const [postTxSyncUntil, setPostTxSyncUntil] = useState(0);
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
      handleError(err.message || `Failed to switch to ${CHAIN_NAME}.`);
    }
  };

  /**
   * Connects the user's wallet using MetaMask and fetches voting sessions.
   */
  const fetchSessions = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoadingContext("sessions");
          setLoading(true);
        }
        const contract = getContract();
        const sessionCount = Number(
          await contract.methods.sessionCount().call(),
        );
        const sessionIds = Array.from(
          { length: sessionCount },
          (_, index) => index,
        );
        const votedCandidatesBySession = await getVotedCandidatesBySession(
          contract,
          account,
          sessionIds,
        );

        const currentTime = Math.floor(Date.now() / 1000);
        const syncedAt = Date.now();
        const fetchedSessions = [];

        for (let i = 0; i < sessionCount; i++) {
          const session = await contract.methods.votingSessions(i).call();
          const candidates = await contract.methods.getCandidates(i).call();
          const hasVoted = await contract.methods
            .hasUserVoted(i, account)
            .call();
          const fallbackCandidateId = getCachedVotedCandidate(i, account);
          const pendingCandidateId = getPendingVotedCandidate(i, account);
          let resolvedCandidateId =
            votedCandidatesBySession[Number(session.id)] ??
            (hasVoted ? fallbackCandidateId : pendingCandidateId);

          if (hasVoted && resolvedCandidateId === null) {
            const onDemandCandidateId = await resolveVotedCandidateFromEvents(
              contract,
              account,
              i,
            );
            if (onDemandCandidateId !== null) {
              resolvedCandidateId = onDemandCandidateId;
              cacheVotedCandidate(i, account, onDemandCandidateId);
            }
          }

          if (hasVoted) {
            clearPendingVotedCandidate(i, account);
          }

          const status = deriveSessionStatus({
            session,
            currentTime,
            candidateCount: candidates.length,
          });
          fetchedSessions.push({
            id: Number(session.id),
            title: session.title,
            startTime: Number(session.startTime),
            endTime: Number(session.endTime),
            status,
            hasVoted,
            votedCandidateId: resolvedCandidateId,
            isVotePending: !hasVoted && resolvedCandidateId !== null,
            syncedAt,
            requiresPassport: session.requiresPassport,
            candidates: candidates.map((candidate, index) => ({
              id: index,
              name: candidate.name,
              votes: candidate.voteCount,
            })),
          });
        }

        // Filter sessions to display only "Not Started" or "Active" sessions
        const filteredSessions = fetchedSessions.filter(
          (session) =>
            session.status === "Not Started" ||
            session.status === "Active" ||
            session.status === "Not Ready",
        );

        setSessions(sortSessionsByRecency(filteredSessions)); // Update state with fetched sessions
      } catch (err) {
        if (!silent) {
          handleError(
            "Could not load sessions. Check your connection and try again.",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [account],
  );

  /**
   * Allows the user to vote for a candidate in a specified session.
   * @param {number} sessionId - ID of the voting session
   * @param {number} candidateId - ID of the candidate
   */
  const voteForCandidate = async (sessionId, candidateId) => {
    try {
      setLoadingContext("voting");
      setLoading(true);
      const contract = getContract();

      // Pre-check Gitcoin Passport if the session requires it
      const session = sessions.find((s) => s.id === sessionId);
      if (session?.requiresPassport) {
        const isHuman = await checkPassportIsHuman(account);
        if (!isHuman) {
          handleSessionError(
            sessionId,
            "This session requires a Gitcoin Passport score of 20 or higher. Visit passport.xyz to verify your identity and then try again.",
          );
          return;
        }
      }

      await assertCanSendTransaction(account);

      // Preflight the call to surface a clear revert reason before sending tx.
      await contract.methods
        .vote(sessionId, candidateId)
        .call({ from: account });

      const method = contract.methods.vote(sessionId, candidateId);
      setPendingVotedCandidate(sessionId, account, candidateId);
      setSessions((prev) =>
        prev.map((entry) =>
          entry.id === sessionId
            ? {
                ...entry,
                votedCandidateId: candidateId,
                isVotePending: true,
              }
            : entry,
        ),
      );

      try {
        const sendOptions = await getRecommendedSendOptions(account);
        await method.send(sendOptions);
      } catch (sendErr) {
        if (!isReplacementUnderpricedError(sendErr)) {
          throw sendErr;
        }

        const bumpedOptions = await getRecommendedSendOptions(account, true);
        await method.send(bumpedOptions);
      }

      clearPendingVotedCandidate(sessionId, account);
      cacheVotedCandidate(sessionId, account, candidateId);
      setPostTxSyncUntil(Date.now() + 30000);
      await fetchSessions(); // Refresh sessions after voting
    } catch (err) {
      clearPendingVotedCandidate(sessionId, account);
      handleSessionError(
        sessionId,
        "Your vote could not be submitted: " +
          parseWeb3ErrorMessage(
            err,
            "Something went wrong. Please check your wallet and try again.",
          ),
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Displays an error message to the user.
   * @param {string} message - Error message to display
   */
  const handleError = (message) => {
    setError(message);
    setTimeout(() => {
      setError("");
    }, 3000);
  };

  const handleSessionError = (sessionId, message) => {
    setSessionErrors((prev) => ({
      ...prev,
      [sessionId]: message,
    }));
    setTimeout(() => {
      setSessionErrors((prev) => ({
        ...prev,
        [sessionId]: "",
      }));
    }, 4000);
  };

  /**
   * Effect hook to connect the wallet and fetch sessions on component mount.
   */
  useEffect(() => {
    if (!walletConnected || !account || !hasResolvedChainId || isWrongNetwork) {
      setSessions([]);
      return;
    }

    fetchSessions();
  }, [
    walletConnected,
    account,
    hasResolvedChainId,
    isWrongNetwork,
    fetchSessions,
  ]);

  useEffect(() => {
    if (walletError) {
      handleError(walletError);
    }
  }, [walletError]);

  useEffect(() => {
    const hasPendingVotes = sessions.some((session) => session.isVotePending);
    if (!hasPendingVotes) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchSessions();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [sessions, fetchSessions]);

  useEffect(() => {
    if (postTxSyncUntil <= Date.now()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() > postTxSyncUntil) {
        setPostTxSyncUntil(0);
        return;
      }

      fetchSessions({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [postTxSyncUntil, fetchSessions]);

  useEffect(() => {
    if (postTxSyncUntil <= Date.now()) return;
    const timeoutId = setTimeout(
      () => setPostTxSyncUntil(0),
      postTxSyncUntil - Date.now(),
    );
    return () => clearTimeout(timeoutId);
  }, [postTxSyncUntil]);

  const activeSessions = sessions.filter(
    (session) => session.status === "Active",
  );
  const upcomingSessions = sessions.filter(
    (session) => session.status === "Not Started",
  );
  const votedSessions = sessions.filter((session) => session.hasVoted);

  return (
    <div className="container page-shell">
      <section className="page-hero page-hero-voting">
        <div>
          <p className="page-kicker">Live participation</p>
          <h1 className="page-title">
            Cast transparent votes with clearer context.
          </h1>
          <p className="page-subtitle">
            Track active sessions, review candidate lists, and confirm that your
            vote lands on Sepolia before the poll closes.
          </p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">Active now</span>
            <strong>{activeSessions.length}</strong>
            <span className="summary-footnote">Ready for immediate voting</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Upcoming</span>
            <strong>{upcomingSessions.length}</strong>
            <span className="summary-footnote">Scheduled sessions</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Already voted</span>
            <strong>{votedSessions.length}</strong>
            <span className="summary-footnote">Your participation history</span>
          </div>
        </div>
      </section>

      {loading && (
        <div className="app-loading-overlay" role="status" aria-live="polite">
          <div className="app-loading-card">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>
              {loadingContext === "voting"
                ? "Submitting your vote..."
                : "Loading voting sessions..."}
            </p>
          </div>
        </div>
      )}

      {!walletConnected ? (
        <section className="connect-panel">
          <div>
            <p className="page-kicker">Wallet required</p>
            <h2>Connect your wallet to see live sessions.</h2>
            <p>
              The app reads active and scheduled sessions directly from the
              contract. Once connected, you can vote without leaving this view.
            </p>
            <div className="feature-row">
              <span className="feature-chip">Optimism Sepolia</span>
              <span className="feature-chip">Transparent history</span>
              <span className="feature-chip">One vote per session</span>
            </div>
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
            <p className="connect-panel-note">
              Your wallet should be on {CHAIN_NAME} before voting.
            </p>
          </div>
        </section>
      ) : (
        <>
          {error && <div className="alert alert-danger">{error}</div>}

          {postTxSyncUntil > Date.now() && (
            <div className="alert alert-info" role="status">
              Fetching the latest results...
            </div>
          )}

          {isWrongNetwork && (
            <div className="alert alert-warning">
              Your wallet is connected to the wrong network. Please switch to{" "}
              {CHAIN_NAME} to vote.
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <div className="badge-container">
                          {session.requiresPassport && (
                            <span
                              className="passport-badge"
                              title="Requires Gitcoin Passport score ≥ 20"
                            >
                              Passport required
                            </span>
                          )}
                          <span
                            className={`session-sync-badge ${
                              session.isVotePending ||
                              postTxSyncUntil > Date.now()
                                ? "session-sync-badge-live"
                                : ""
                            }`}
                          >
                            <span
                              className="session-sync-dot"
                              aria-hidden="true"
                            />
                            Last updated: {formatSyncTime(session.syncedAt)}
                          </span>
                        </div>
                      </div>
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

                  {(session.hasVoted || session.isVotePending) && (
                    <div className="vote-confirmation" role="status">
                      <span className="vote-confirmation-label">
                        {session.hasVoted ? "Vote confirmed" : "Vote submitted"}
                      </span>
                      <strong className="vote-confirmation-text">
                        {session.hasVoted
                          ? "Your vote has already been recorded for this session."
                          : "Waiting for blockchain confirmation. This may take a short while."}
                      </strong>
                    </div>
                  )}

                  <div className="candidate-stack">
                    {session.candidates.map((candidate) => (
                      <div
                        className={`candidate-row ${
                          (session.hasVoted || session.isVotePending) &&
                          candidate.id === session.votedCandidateId
                            ? "candidate-row-voted"
                            : ""
                        }`}
                        key={candidate.id}
                      >
                        <div>
                          <strong>{candidate.name}</strong>
                        </div>
                        {session.hasVoted || session.isVotePending ? (
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
                          ) : null // Removed "Not selected" for other candidates
                        ) : session.status === "Active" ? (
                          <button
                            className="btn btn-primary session-action"
                            onClick={() =>
                              voteForCandidate(session.id, candidate.id)
                            }
                            disabled={isWrongNetwork || session.isVotePending}
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
                    ))}
                  </div>

                  {sessionErrors[session.id] && (
                    <div className="admin-feedback-inline" aria-live="polite">
                      <div
                        className="admin-feedback-toast admin-feedback-toast-error"
                        role="alert"
                      >
                        <span className="admin-feedback-label">
                          Action required
                        </span>
                        <strong className="admin-feedback-message">
                          {sessionErrors[session.id]}
                        </strong>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          ) : (
            <section className="empty-state-panel">
              <h3>No active voting sessions yet</h3>
              <p>
                Once an admin creates a future or live session, it will appear
                here automatically.
              </p>
            </section>
          )}

          <section className="insight-panel legal-panel">
            <div>
              <p className="page-kicker">Participation policy</p>
              <h3>Important legal considerations</h3>
              <p>
                This voting application uses blockchain technology to ensure
                transparency and immutability of records.
              </p>
            </div>
            <ul className="legal-list">
              <li>
                <strong>Transparency:</strong> All transactions are stored
                publicly on the blockchain and cannot be altered or deleted.
              </li>
              <li>
                <strong>Privacy:</strong> Your wallet address is visible on the
                blockchain, but no personal information is stored by this
                application.
              </li>
              <li>
                <strong>GDPR Compliance:</strong> By participating, you
                acknowledge that blockchain data cannot be modified or erased,
                as per the decentralized nature of the technology.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default VotingPage;
