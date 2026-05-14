import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { getContract, SEPOLIA_CHAIN_ID_HEX } from "../utils/web3";

const formatTimestamp = (timestamp) =>
  new Date(timestamp * 1000).toLocaleString();

const getVotedCandidatesBySession = async (contract, account) => {
  try {
    const voteEvents = await contract.getPastEvents("VoteCast", {
      filter: { voter: account },
      fromBlock: 0,
      toBlock: "latest",
    });

    return voteEvents.reduce((acc, event) => {
      const sessionId = Number(event.returnValues.sessionId);
      const candidateId = Number(event.returnValues.candidateId);
      acc[sessionId] = candidateId;
      return acc;
    }, {});
  } catch (err) {
    console.error("Failed to resolve voted candidates from events:", err);
    return {};
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
  const {
    walletConnected,
    account,
    walletError,
    isWrongNetwork,
    connectWallet,
  } = useWallet();

  /**
   * Connects the user's wallet using MetaMask and fetches voting sessions.
   */
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract();
      const votedCandidatesBySession = await getVotedCandidatesBySession(
        contract,
        account,
      );

      const sessionCount = await contract.methods.sessionCount().call();

      const currentTime = Math.floor(Date.now() / 1000);
      const fetchedSessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const candidates = await contract.methods.getCandidates(i).call();
        const hasVoted = await contract.methods.hasUserVoted(i, account).call();
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
          votedCandidateId: votedCandidatesBySession[Number(session.id)],
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

      // Sort sessions by their status
      filteredSessions.sort((a, b) => {
        const statusOrder = { Active: 1, "Not Ready": 2, "Not Started": 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

      setSessions(filteredSessions); // Update state with fetched sessions
    } catch (err) {
      handleError("Failed to fetch sessions: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [account]);

  /**
   * Allows the user to vote for a candidate in a specified session.
   * @param {number} sessionId - ID of the voting session
   * @param {number} candidateId - ID of the candidate
   */
  const voteForCandidate = async (sessionId, candidateId) => {
    console.log(
      `Attempting to vote: sessionId=${sessionId}, candidateId=${candidateId}`,
    );
    console.log(`Using account: ${account}`);
    try {
      setLoading(true);
      const contract = getContract();
      console.log("Contract instance retrieved.");

      await contract.methods
        .vote(sessionId, candidateId)
        .send({ from: account })
        .on("transactionHash", (hash) => {
          console.log(`Transaction hash: ${hash}`);
        })
        .on("receipt", (receipt) => {
          console.log("Transaction receipt:", receipt);
        })
        .on("error", (error) => {
          console.error("Transaction error:", error);
        });

      console.log("Vote transaction sent successfully.");
      await fetchSessions(); // Refresh sessions after voting
    } catch (err) {
      console.error("Failed to vote:", err);
      handleError("Failed to vote: " + err.message);
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

  /**
   * Effect hook to connect the wallet and fetch sessions on component mount.
   */
  useEffect(() => {
    if (!walletConnected || !account || isWrongNetwork) {
      setSessions([]);
      return;
    }

    fetchSessions();
  }, [walletConnected, account, isWrongNetwork, fetchSessions]);

  useEffect(() => {
    if (walletError) {
      handleError(walletError);
    }
  }, [walletError]);

  useEffect(() => {
    if (isWrongNetwork) {
      console.warn("User is on the wrong network. Expected Sepolia.");
    }

    if (!walletConnected) {
      console.warn("Wallet is not connected.");
    }

    if (!account) {
      console.warn("No account detected. Please connect your wallet.");
    }
  }, [isWrongNetwork, walletConnected, account]);

  useEffect(() => {
    sessions.forEach((session) => {
      console.log(
        `Session ${session.id}: hasVoted=${session.hasVoted}, status=${session.status}`,
      );
      session.candidates.forEach((candidate) => {
        console.log(
          `Candidate ${candidate.id} (${candidate.name}): votes=${candidate.votes}`,
        );
      });
    });
  }, [sessions]);

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
            <p>Refreshing voting data on-chain...</p>
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
              <span className="feature-chip">Sepolia-ready</span>
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
              Your wallet should be on Ethereum Sepolia before voting.
            </p>
          </div>
        </section>
      ) : (
        <>
          {error && <div className="alert alert-danger">{error}</div>}

          {isWrongNetwork && (
            <div className="alert alert-warning">
              Switch wallet network to Sepolia ({SEPOLIA_CHAIN_ID_HEX}) to vote.
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

                  {session.hasVoted && (
                    <div className="vote-confirmation" role="status">
                      <span className="vote-confirmation-label">
                        Vote confirmed
                      </span>
                      <strong className="vote-confirmation-text">
                        Your vote has already been recorded for this session.
                      </strong>
                    </div>
                  )}

                  <div className="candidate-stack">
                    {session.candidates.map((candidate) => (
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
                          ) : null // Removed "Not selected" for other candidates
                        ) : session.status === "Active" ? (
                          <button
                            className="btn btn-success session-action"
                            onClick={() =>
                              voteForCandidate(session.id, candidate.id)
                            }
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
                    ))}
                  </div>
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
