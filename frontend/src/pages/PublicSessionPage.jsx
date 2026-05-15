import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
  const [loadingContext, setLoadingContext] = useState("session"); // 'session' | 'voting'
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

  const numericSessionId = Number(sessionId);

  const handleError = (message) => {
    setError(message);
    setTimeout(() => setError(""), 3000);
  };

  const handleSessionError = (message) => {
    setSessionError(message);
    setTimeout(() => setSessionError(""), 4000);
  };

  const fetchSession = useCallback(
    async ({ silent = false } = {}) => {
      if (Number.isNaN(numericSessionId) || numericSessionId < 0) {
        setSession(null);
        handleError(
          "This session link is not valid. Please check the URL and try again.",
        );
        return;
      }

      try {
        if (!silent) {
          setLoadingContext("session");
          setLoading(true);
        }
        const contract = getContract();
        const sessionCount = Number(
          await contract.methods.sessionCount().call(),
        );

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
        const syncedAt = Date.now();
        const status = deriveSessionStatus({
          session: sessionData,
          currentTime,
          candidateCount: candidates.length,
        });

        const hasVoted = account
          ? await contract.methods
              .hasUserVoted(numericSessionId, account)
              .call()
          : false;
        const pendingCandidateId = getPendingVotedCandidate(
          numericSessionId,
          account,
        );

        let votedCandidateId = null;
        if (account && hasVoted) {
          votedCandidateId = getCachedVotedCandidate(numericSessionId, account);

          try {
            const latestCandidateId = await resolveVotedCandidateFromEvents(
              contract,
              account,
              numericSessionId,
            );

            if (latestCandidateId !== null) {
              votedCandidateId = latestCandidateId;
              cacheVotedCandidate(numericSessionId, account, latestCandidateId);
            }
          } catch (eventErr) {
            // Some RPC endpoints intermittently fail on log queries; keep session visible.
            console.warn(
              "Could not fetch VoteCast history for voted candidate highlight:",
              eventErr,
            );
          }
        } else if (account) {
          votedCandidateId = pendingCandidateId;
        }

        if (hasVoted && account) {
          clearPendingVotedCandidate(numericSessionId, account);
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
          isVotePending: !hasVoted && votedCandidateId !== null,
          syncedAt,
          requiresPassport: sessionData.requiresPassport,
          winner,
          isTie,
          candidates: candidates.map((candidate, index) => ({
            id: index,
            name: candidate.name,
            votes: Number(candidate.voteCount),
          })),
        });
      } catch (err) {
        if (!silent) {
          handleError(
            "Could not load this session. Check your connection and try again.",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [numericSessionId, account],
  );

  const voteForCandidate = async (candidateId) => {
    if (!session) return;

    try {
      setLoadingContext("voting");
      setLoading(true);

      // Pre-check Gitcoin Passport if the session requires it
      if (session.requiresPassport) {
        const isHuman = await checkPassportIsHuman(account);
        if (!isHuman) {
          handleSessionError(
            "This session requires a Gitcoin Passport score of 20 or higher. Visit passport.xyz to verify your identity and then try again.",
          );
          return;
        }
      }

      await assertCanSendTransaction(account);

      const contract = getContract();
      // Preflight the call to surface a clear revert reason before sending tx.
      await contract.methods
        .vote(session.id, candidateId)
        .call({ from: account });
      const method = contract.methods.vote(session.id, candidateId);
      setPendingVotedCandidate(session.id, account, candidateId);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              votedCandidateId: candidateId,
              isVotePending: true,
            }
          : prev,
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
      clearPendingVotedCandidate(session.id, account);
      cacheVotedCandidate(session.id, account, candidateId);
      setPostTxSyncUntil(Date.now() + 30000);
      await fetchSession();
    } catch (err) {
      clearPendingVotedCandidate(session.id, account);
      handleSessionError(
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

  useEffect(() => {
    if (!walletConnected || !account || !hasResolvedChainId || isWrongNetwork) {
      setSession(null);
      return;
    }

    fetchSession();
  }, [
    walletConnected,
    account,
    hasResolvedChainId,
    isWrongNetwork,
    fetchSession,
  ]);

  useEffect(() => {
    if (walletError) {
      handleError(walletError);
    }
  }, [walletError]);

  useEffect(() => {
    if (!session?.isVotePending) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchSession();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [session, fetchSession]);

  useEffect(() => {
    if (postTxSyncUntil <= Date.now()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() > postTxSyncUntil) {
        setPostTxSyncUntil(0);
        return;
      }

      fetchSession({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [postTxSyncUntil, fetchSession]);

  useEffect(() => {
    if (postTxSyncUntil <= Date.now()) return;
    const timeoutId = setTimeout(
      () => setPostTxSyncUntil(0),
      postTxSyncUntil - Date.now(),
    );
    return () => clearTimeout(timeoutId);
  }, [postTxSyncUntil]);

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
            <p>
              {loadingContext === "voting"
                ? "Submitting your vote..."
                : "Loading session details..."}
            </p>
          </div>
        </div>
      )}

      {!walletConnected ? (
        <section className="connect-panel">
          <div>
            <p className="page-kicker">Wallet required</p>
            <h2>Connect your wallet to access this session.</h2>
            <p>You need a wallet connection to participate in this session.</p>
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

          {postTxSyncUntil > Date.now() && (
            <div className="alert alert-info" role="status">
              Fetching the latest results...
            </div>
          )}

          {isWrongNetwork && (
            <div className="alert alert-warning">
              Your wallet is connected to the wrong network. Please switch to{" "}
              {CHAIN_NAME} to use this session.
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
                          session.isVotePending || postTxSyncUntil > Date.now()
                            ? "session-sync-badge-live"
                            : ""
                        }`}
                      >
                        <span className="session-sync-dot" aria-hidden="true" />
                        Last updated: {formatSyncTime(session.syncedAt)}
                      </span>
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

                {session.status !== "Completed" &&
                (session.hasVoted || session.isVotePending) ? (
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
                          ) : null
                        ) : session.status === "Active" ? (
                          <button
                            className="btn btn-primary session-action"
                            onClick={() => voteForCandidate(candidate.id)}
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
