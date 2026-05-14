import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  getContract,
  SEPOLIA_CHAIN_ID_HEX,
  shortenAddress,
} from "../utils/web3";

const formatTimestamp = (timestamp) =>
  new Date(timestamp * 1000).toLocaleString();

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
  const [sessions, setSessions] = useState([]);
  const [candidatesBySession, setCandidatesBySession] = useState({});
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState("global");
  const [loading, setLoading] = useState(false);
  const {
    walletConnected,
    account,
    walletError,
    isWrongNetwork,
    connectWallet,
  } = useWallet();

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

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract();
      const sessionCount = await contract.methods.sessionCount().call();
      const currentTime = Math.floor(Date.now() / 1000);
      const fetchedSessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const creator = await contract.methods.getSessionCreator(i).call();
        const candidates = await contract.methods.getCandidates(i).call();
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
          creator,
        });
      }

      // Sort sessions by recency: newest first, oldest last.
      fetchedSessions.sort(
        (a, b) =>
          b.endTime - a.endTime || b.startTime - a.startTime || b.id - a.id,
      );

      setSessions(fetchedSessions);
      await Promise.all(
        fetchedSessions.map((session) => fetchCandidates(session.id)),
      );
    } catch (err) {
      console.error("Error fetching sessions:", err);
      handleError("Failed to fetch sessions: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchCandidates]);

  const createSession = async () => {
    try {
      if (!title || !startTime || !endTime) {
        throw new Error("All fields are required to create a session.");
      }

      setLoading(true);

      const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);

      if (startTimeUnix >= endTimeUnix) {
        throw new Error("Start time must be before end time.");
      }

      const contract = getContract();
      await contract.methods
        .createVotingSession(title, startTimeUnix, endTimeUnix)
        .send({ from: account });

      setTitle("");
      setStartTime("");
      setEndTime("");

      await fetchSessions();
      handleSuccess("Voting session created successfully!", "create");
    } catch (err) {
      console.error("Error creating session:", err);
      handleError("Failed to create session: " + err.message, "create");
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async () => {
    try {
      if (!selectedSessionId || candidateName.trim() === "") {
        throw new Error(
          "Please select a valid session and enter a candidate name.",
        );
      }

      setLoading(true);

      const sessionId = Number(selectedSessionId);
      if (Number.isNaN(sessionId)) {
        throw new Error("Invalid session ID.");
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
          "You cannot add a candidate to a voting session that has already ended.",
        );
      }

      if (
        currentTime >= selectedSession.startTime &&
        currentTime <= selectedSession.endTime
      ) {
        throw new Error("Candidates cannot be added during the voting period.");
      }

      if (selectedSession.creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error(
          "Only the creator of this voting session can add candidates.",
        );
      }

      const contract = getContract();
      await contract.methods
        .addCandidate(sessionId, candidateName)
        .send({ from: account });

      setCandidateName("");
      await fetchCandidates(sessionId);
      handleSuccess("Candidate added successfully!", "candidate");
    } catch (err) {
      console.error("Error adding candidate:", err);
      handleError(err.message, "candidate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!walletConnected || !account || isWrongNetwork) {
      setSessions([]);
      setCandidatesBySession({});
      return;
    }

    fetchSessions();
  }, [walletConnected, account, isWrongNetwork, fetchSessions]);

  useEffect(() => {
    if (walletError) {
      handleError(walletError, "global");
    }
  }, [walletError]);

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
            <p>Syncing admin actions with the contract...</p>
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
              Switch wallet network to Sepolia ({SEPOLIA_CHAIN_ID_HEX}) to use
              admin actions.
            </div>
          )}

          {(successMessage || errorMessage) && feedbackTarget === "global" && (
            <section className="admin-feedback-region" aria-live="polite">
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
              <p className="required-hint">
                <span className="required-marker" aria-hidden="true">
                  ★
                </span>{" "}
                All fields are required
              </p>
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
              </div>
              <button
                className="btn btn-success app-cta"
                onClick={createSession}
                disabled={isWrongNetwork}
              >
                Create session
              </button>
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
              <p className="required-hint">
                <span className="required-marker" aria-hidden="true">
                  ★
                </span>{" "}
                All fields are required
              </p>
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
                className="btn btn-warning app-cta"
                onClick={addCandidate}
                disabled={isWrongNetwork}
              >
                Add candidate
              </button>
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

                <div className="candidate-stack">
                  {candidatesBySession[session.id]?.length > 0 ? (
                    candidatesBySession[session.id].map((candidate) => (
                      <div className="candidate-row" key={candidate.id}>
                        <div>
                          <strong>{candidate.name}</strong>
                        </div>
                        <span className="candidate-state">Ready</span>
                      </div>
                    ))
                  ) : (
                    <div className="inline-note inline-note-muted">
                      No candidates have been added to this session yet.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
