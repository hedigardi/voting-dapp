import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  assertCanSendTransaction,
  getContract,
  getRecommendedSendOptions,
  isReplacementUnderpricedError,
  parseWeb3ErrorMessage,
  CHAIN_NAME,
  sortSessionsByRecency,
  switchToSupportedNetwork,
  shortenAddress,
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

const toSafeNumber = (value) => {
  try {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const formatVoteCount = (count) => {
  const voteCount = toSafeNumber(count);
  return `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
};

const deriveSessionStatus = ({ session, currentTime, candidateCount }) => {
  if (!session.isActive) return "Inactive";
  if (currentTime > Number(session.endTime)) return "Completed";
  if (currentTime < Number(session.startTime)) return "Not Started";
  if (candidateCount === 0) return "Not Ready";
  return "Active";
};

const getStatusTone = (status) => {
  if (status === "Active") return "status-pill status-pill-live";
  if (status === "Not Started") return "status-pill status-pill-upcoming";
  if (status === "Completed") return "status-pill status-pill-done";
  return "status-pill status-pill-neutral";
};

const AdminPanel = () => {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [requiresPassport, setRequiresPassport] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [candidatesBySession, setCandidatesBySession] = useState({});
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState("global");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [postTxSyncUntil, setPostTxSyncUntil] = useState(0);
  const [copiedSessionId, setCopiedSessionId] = useState(null);
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

  const handleError = (message, target = "global") => {
    setSuccessMessage("");
    setErrorMessage(message);
    setFeedbackTarget(target);
    setTimeout(() => setErrorMessage(""), 3000);
  };

  const handleSuccess = (message, target = "global") => {
    setErrorMessage("");
    setSuccessMessage(message);
    setFeedbackTarget(target);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const getSessionShareUrl = (sessionId) => {
    if (typeof window === "undefined") {
      return `/s/${sessionId}`;
    }

    return `${window.location.origin}/s/${sessionId}`;
  };

  const copySessionLink = async (sessionId) => {
    const shareUrl = getSessionShareUrl(sessionId);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedSessionId(sessionId);
      setTimeout(() => setCopiedSessionId(null), 2000);
    } catch (err) {
      handleError(
        "Could not copy the link. Try copying it manually.",
        "global",
      );
    }
  };

  const sendWithPendingRetry = async (method, target, meta = {}) => {
    const sendOnce = async (bump = false) =>
      new Promise((resolve, reject) => {
        let promiEvent;

        const onHash = (hash) => {
          setErrorMessage("");
          setFeedbackTarget(target);
          setPendingAction({
            target,
            txHash: hash,
            ...meta,
          });
        };

        const onReceipt = (receipt) => {
          resolve(receipt);
        };

        const onError = (error) => {
          reject(error);
        };

        (async () => {
          try {
            const sendOptions = await getRecommendedSendOptions(account, bump);
            promiEvent = method.send(sendOptions);
            promiEvent.on("transactionHash", onHash);
            promiEvent.on("receipt", onReceipt);
            promiEvent.on("error", onError);
          } catch (setupErr) {
            reject(setupErr);
          }
        })();
      });

    try {
      return await sendOnce(false);
    } catch (sendErr) {
      if (!isReplacementUnderpricedError(sendErr)) {
        throw sendErr;
      }

      return sendOnce(true);
    }
  };

  const fetchCandidates = useCallback(async (sessionId) => {
    try {
      const contract = getContract();
      const candidates = await contract.methods.getCandidates(sessionId).call();
      setCandidatesBySession((prev) => ({
        ...prev,
        [sessionId]: candidates.map((candidate, index) => ({
          id: index,
          name: candidate.name,
          votes: candidate.voteCount,
        })),
      }));
    } catch (err) {
      console.error(`Error fetching candidates for session ${sessionId}:`, err);
    }
  }, []);

  const fetchSessions = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        const contract = getContract();
        const sessionCount = Number(
          await contract.methods.sessionCount().call(),
        );
        const currentTime = Math.floor(Date.now() / 1000);
        const syncedAt = Date.now();
        const fetchedSessions = [];

        for (let i = 0; i < sessionCount; i++) {
          try {
            const session = await contract.methods.votingSessions(i).call();
            const candidates = await contract.methods.getCandidates(i).call();
            const status = deriveSessionStatus({
              session,
              currentTime,
              candidateCount: candidates.length,
            });

            let winner = "";
            let isTie = false;

            if (status === "Completed" && candidates.length > 0) {
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

            fetchedSessions.push({
              id: Number(session.id),
              title: session.title,
              startTime: Number(session.startTime),
              endTime: Number(session.endTime),
              status,
              creator: session.creator,
              requiresPassport: session.requiresPassport,
              winner: candidates.length > 0 ? winner : "No candidates",
              isTie: candidates.length > 0 && isTie,
              syncedAt,
            });
          } catch (sessionErr) {
            // Skip a malformed/unreadable session entry rather than failing the entire list.
            console.error(`Error fetching session ${i}:`, sessionErr);
          }
        }

        setSessions(sortSessionsByRecency(fetchedSessions));
        await Promise.all(
          fetchedSessions.map((session) => fetchCandidates(session.id)),
        );
      } catch (err) {
        console.error("Error fetching sessions:", err);
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
    [fetchCandidates],
  );

  const createSession = async () => {
    try {
      if (!title || !startTime || !endTime) {
        throw new Error(
          "Please fill in all required fields before continuing.",
        );
      }

      setLoading(true);

      const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);

      if (startTimeUnix >= endTimeUnix) {
        throw new Error("Start time must be before end time.");
      }

      await assertCanSendTransaction(account);

      const contract = getContract();
      const nextSessionId = Number(
        await contract.methods.sessionCount().call(),
      );
      let receipt;
      const method = contract.methods.createVotingSession(
        title,
        startTimeUnix,
        endTimeUnix,
        requiresPassport,
      );
      receipt = await sendWithPendingRetry(method, "create");

      const createdSessionId = Number(
        receipt?.events?.VotingSessionCreated?.returnValues?.sessionId ??
          nextSessionId,
      );

      setTitle("");
      setStartTime("");
      setEndTime("");
      setRequiresPassport(false);

      await fetchSessions();
      setPostTxSyncUntil(Date.now() + 30000);
      setPendingAction(null);
      setSelectedSessionId(String(createdSessionId));
      handleSuccess("Your voting session was created!", "create");
    } catch (err) {
      setPendingAction(null);
      console.error("Error creating session:", err);
      handleError(
        "Could not create the session: " +
          parseWeb3ErrorMessage(err, "Something went wrong. Please try again."),
        "create",
      );
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async () => {
    try {
      if (!selectedSessionId || candidateName.trim() === "") {
        throw new Error("Please select a session and enter a candidate name.");
      }

      setLoading(true);

      const sessionId = Number(selectedSessionId);
      if (Number.isNaN(sessionId)) {
        throw new Error(
          "Could not find the selected session. Please refresh and try again.",
        );
      }

      const selectedSession = sessions.find(
        (session) => session.id === sessionId,
      );
      if (!selectedSession) {
        throw new Error("Selected session does not exist.");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime > selectedSession.endTime) {
        throw new Error(
          "This voting session has already ended. Candidates can only be added before it starts.",
        );
      }

      if (
        currentTime >= selectedSession.startTime &&
        currentTime <= selectedSession.endTime
      ) {
        throw new Error(
          "Voting is currently open. Candidates can only be added before the session starts.",
        );
      }

      if (selectedSession.creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error(
          "Only the wallet that created this session can add candidates.",
        );
      }

      await assertCanSendTransaction(account);

      const contract = getContract();
      const method = contract.methods.addCandidate(sessionId, candidateName);
      await sendWithPendingRetry(method, "candidate", { sessionId });

      setCandidateName("");
      await fetchCandidates(sessionId);
      await fetchSessions();
      setPostTxSyncUntil(Date.now() + 30000);
      setPendingAction(null);
      handleSuccess("Candidate added successfully!", "candidate");
    } catch (err) {
      setPendingAction(null);
      console.error("Error adding candidate:", err);
      handleError(
        parseWeb3ErrorMessage(
          err,
          "Could not add the candidate. Please try again.",
        ),
        "candidate",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!walletConnected || !account || !hasResolvedChainId || isWrongNetwork) {
      setSessions([]);
      setCandidatesBySession({});
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
      handleError(walletError, "global");
    }
  }, [walletError]);

  useEffect(() => {
    if (!pendingAction) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (pendingAction.target === "candidate") {
        fetchCandidates(pendingAction.sessionId);
      }
      fetchSessions();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [pendingAction, fetchCandidates, fetchSessions]);

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

  const managedSessions = sessions.filter(
    (session) => session.creator.toLowerCase() === account.toLowerCase(),
  );
  const liveSessions = sessions.filter(
    (session) => session.status === "Active",
  );
  const draftSessions = sessions.filter(
    (session) => session.status === "Not Started",
  );

  return (
    <div className="container page-shell">
      <section className="page-hero page-hero-admin">
        <div>
          <p className="page-kicker">Governance studio</p>
          <h1 className="page-title">Shape sessions before voters arrive.</h1>
          <p className="page-subtitle">
            Create voting windows, prepare candidate slates, and monitor which
            sessions are live, upcoming, or already locked in history.
          </p>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">Managed by you</span>
            <strong>{managedSessions.length}</strong>
            <span className="summary-footnote">Sessions from this wallet</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Upcoming</span>
            <strong>{draftSessions.length}</strong>
            <span className="summary-footnote">Ready for candidate setup</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Live polls</span>
            <strong>{liveSessions.length}</strong>
            <span className="summary-footnote">Currently collecting votes</span>
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
              {pendingAction?.txHash
                ? `Transaction sent (${shortenAddress(
                    pendingAction.txHash,
                  )}). Waiting for confirmation on the blockchain...`
                : pendingAction
                  ? "Saving your changes to the blockchain..."
                  : "Loading sessions..."}
            </p>
          </div>
        </div>
      )}

      {!walletConnected ? (
        <section className="connect-panel">
          <div>
            <p className="page-kicker">Admin access</p>
            <h2>Connect the creator wallet to manage governance.</h2>
            <p>
              Session creation and candidate management are permissioned by the
              connected account, so this page only becomes actionable after your
              wallet is connected.
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
            <p className="connect-panel-note">
              Use the same wallet that deployed or created the session.
            </p>
          </div>
        </section>
      ) : (
        <>
          {isWrongNetwork && (
            <div className="alert alert-warning">
              Your wallet is connected to the wrong network. Please switch to{" "}
              {CHAIN_NAME} to use admin actions.
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

          {(successMessage || errorMessage) && feedbackTarget === "global" && (
            <section className="admin-feedback-region" aria-live="polite">
              {postTxSyncUntil > Date.now() && (
                <div
                  className="admin-feedback-toast admin-feedback-toast-success"
                  role="status"
                >
                  <span className="admin-feedback-label">Syncing</span>
                  <strong className="admin-feedback-message">
                    Updating on-chain changes in the background...
                  </strong>
                </div>
              )}
              {successMessage && (
                <div
                  className="admin-feedback-toast admin-feedback-toast-success"
                  role="status"
                >
                  <span className="admin-feedback-label">Success</span>
                  <strong className="admin-feedback-message">
                    {successMessage}
                  </strong>
                </div>
              )}
              {errorMessage && (
                <div
                  className="admin-feedback-toast admin-feedback-toast-error"
                  role="alert"
                >
                  <span className="admin-feedback-label">Action required</span>
                  <strong className="admin-feedback-message">
                    {errorMessage}
                  </strong>
                </div>
              )}
            </section>
          )}

          <section className="admin-grid">
            <article className="form-panel">
              <div className="panel-header">
                <p className="page-kicker">Step 1</p>
                <h3>Create a voting session</h3>
              </div>
              <div className="form-stack">
                <div>
                  <label className="form-label">
                    Session title
                    <span className="required-marker" aria-hidden="true">
                      *
                    </span>
                    <span className="visually-hidden">required</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Student council election"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Start time
                    <span className="required-marker" aria-hidden="true">
                      *
                    </span>
                    <span className="visually-hidden">required</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">
                    End time
                    <span className="required-marker" aria-hidden="true">
                      *
                    </span>
                    <span className="visually-hidden">required</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div className="passport-toggle-field">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="requiresPassport"
                      checked={requiresPassport}
                      onChange={(e) => setRequiresPassport(e.target.checked)}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="requiresPassport"
                    >
                      Require Gitcoin Passport
                    </label>
                  </div>
                  <p className="passport-toggle-hint">
                    Voters must have a Gitcoin Passport score of 20+ to vote in
                    this session.
                    <a
                      href="https://passport.xyz"
                      target="_blank"
                      rel="noreferrer"
                      className="passport-toggle-link"
                    >
                      Learn more
                    </a>
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary app-cta"
                onClick={createSession}
                disabled={isWrongNetwork || pendingAction?.target === "create"}
              >
                {pendingAction?.target === "create"
                  ? "Creating session..."
                  : "Create session"}
              </button>
              {pendingAction?.target === "create" && (
                <div className="admin-feedback-inline" aria-live="polite">
                  <div
                    className="admin-feedback-toast admin-feedback-toast-success"
                    role="status"
                  >
                    <span className="admin-feedback-label">Pending</span>
                    <strong className="admin-feedback-message">
                      Transaction submitted in your wallet. Waiting for network
                      confirmation.
                    </strong>
                  </div>
                </div>
              )}
              {(successMessage || errorMessage) &&
                feedbackTarget === "create" && (
                  <div className="admin-feedback-inline" aria-live="polite">
                    {successMessage && (
                      <div
                        className="admin-feedback-toast admin-feedback-toast-success"
                        role="status"
                      >
                        <span className="admin-feedback-label">Success</span>
                        <strong className="admin-feedback-message">
                          {successMessage}
                        </strong>
                      </div>
                    )}
                    {errorMessage && (
                      <div
                        className="admin-feedback-toast admin-feedback-toast-error"
                        role="alert"
                      >
                        <span className="admin-feedback-label">
                          Action required
                        </span>
                        <strong className="admin-feedback-message">
                          {errorMessage}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
            </article>

            <article className="form-panel">
              <div className="panel-header">
                <p className="page-kicker">Step 2</p>
                <h3>Add candidates</h3>
              </div>
              <div className="form-stack">
                <div>
                  <label className="form-label">
                    Target session
                    <span className="required-marker" aria-hidden="true">
                      *
                    </span>
                    <span className="visually-hidden">required</span>
                  </label>
                  <select
                    className="form-select"
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    value={selectedSessionId}
                  >
                    <option value="" disabled>
                      Select a session
                    </option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">
                    Candidate name
                    <span className="required-marker" aria-hidden="true">
                      *
                    </span>
                    <span className="visually-hidden">required</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Candidate name"
                  />
                </div>
              </div>
              <button
                className="btn btn-primary app-cta"
                onClick={addCandidate}
                disabled={
                  isWrongNetwork || pendingAction?.target === "candidate"
                }
              >
                {pendingAction?.target === "candidate"
                  ? "Adding candidate..."
                  : "Add candidate"}
              </button>
              {pendingAction?.target === "candidate" && (
                <div className="admin-feedback-inline" aria-live="polite">
                  <div
                    className="admin-feedback-toast admin-feedback-toast-success"
                    role="status"
                  >
                    <span className="admin-feedback-label">Pending</span>
                    <strong className="admin-feedback-message">
                      Candidate transaction submitted. Waiting for network
                      confirmation.
                    </strong>
                  </div>
                </div>
              )}
              {(successMessage || errorMessage) &&
                feedbackTarget === "candidate" && (
                  <div className="admin-feedback-inline" aria-live="polite">
                    {successMessage && (
                      <div
                        className="admin-feedback-toast admin-feedback-toast-success"
                        role="status"
                      >
                        <span className="admin-feedback-label">Success</span>
                        <strong className="admin-feedback-message">
                          {successMessage}
                        </strong>
                      </div>
                    )}
                    {errorMessage && (
                      <div
                        className="admin-feedback-toast admin-feedback-toast-error"
                        role="alert"
                      >
                        <span className="admin-feedback-label">
                          Action required
                        </span>
                        <strong className="admin-feedback-message">
                          {errorMessage}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
            </article>
          </section>

          <section className="insight-panel admin-tip-panel">
            <div>
              <p className="page-kicker">Workflow tip</p>
              <h3>Populate candidates before the session opens.</h3>
            </div>
            <p>
              Candidate edits are blocked during the active voting window, so it
              is safest to prepare the ballot while the session is still in the
              upcoming state.
            </p>
          </section>

          <section className="session-grid">
            {sessions.map((session) => (
              <article className="session-card" key={session.id}>
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
                          postTxSyncUntil > Date.now()
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
                    <span className="wallet-label">Start</span>
                    <strong>{formatTimestamp(session.startTime)}</strong>
                  </div>
                  <div>
                    <span className="wallet-label">End</span>
                    <strong>{formatTimestamp(session.endTime)}</strong>
                  </div>
                  <div>
                    <span className="wallet-label">Creator</span>
                    <strong>{shortenAddress(session.creator)}</strong>
                  </div>
                </div>

                <div className="session-share-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={() => copySessionLink(session.id)}
                  >
                    {copiedSessionId === session.id ? "Copied" : "Copy link"}
                  </button>
                  <a
                    className="btn btn-primary btn-sm"
                    href={getSessionShareUrl(session.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open voter view
                  </a>
                  {copiedSessionId === session.id && (
                    <p className="session-copy-feedback" role="status">
                      Session link copied
                    </p>
                  )}
                </div>

                <div className="candidate-stack">
                  {candidatesBySession[session.id]?.length > 0 ? (
                    candidatesBySession[session.id].map((candidate) => {
                      const candidateVotes = toSafeNumber(candidate.votes);
                      const topVotes = candidatesBySession[session.id].reduce(
                        (maxVotes, entry) => {
                          const currentVotes = toSafeNumber(entry.votes);
                          return currentVotes > maxVotes
                            ? currentVotes
                            : maxVotes;
                        },
                        1,
                      );

                      const percent =
                        topVotes > 0
                          ? Number((candidateVotes * 10000) / topVotes) / 100
                          : 0;
                      const widthValue =
                        candidateVotes > 0 ? Math.max(percent, 12) : 0;
                      const width = `${Math.min(widthValue, 100)}%`;

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
                    })
                  ) : (
                    <div className="inline-note inline-note-muted">
                      No candidates have been added to this session yet.
                    </div>
                  )}
                </div>

                {session.status === "Completed" &&
                  (() => {
                    const isNoCandidates = session.winner === "No candidates";
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
                        : session.winner || "Winner unavailable";

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
        </>
      )}
    </div>
  );
};

export default AdminPanel;
