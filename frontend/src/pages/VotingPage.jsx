import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { contractAddress, contractABI } from '../utils/contractConfig';

/**
 * VotingPage component allows users to view active voting sessions and cast votes.
 */
const VotingPage = () => {
  // State variables
  const [sessions, setSessions] = useState([]); // Stores fetched voting sessions
  const [error, setError] = useState(''); // For displaying error messages
  const [walletConnected, setWalletConnected] = useState(false); // Tracks wallet connection status
  const [loading, setLoading] = useState(false); // Tracks loading state for displaying the spinner
  const [userVotes, setUserVotes] = useState({}); // Tracks user's voting status per session

  /**
   * Connects the user's wallet using MetaMask and fetches voting sessions.
   */
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      console.log('Connected account:', accounts[0]);
      setWalletConnected(true);
      await fetchSessions(); // Fetch sessions after wallet connection
    } catch (err) {
      handleError('Failed to connect wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches all voting sessions from the smart contract.
   */
  const fetchSessions = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const contract = new web3.eth.Contract(contractABI, contractAddress);

      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];

      const sessionCount = await contract.methods.sessionCount().call();
      console.log('Total Sessions:', sessionCount);

      const currentTime = Math.floor(Date.now() / 1000);
      const fetchedSessions = [];
      const userVoteStatus = {};

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const candidates = await contract.methods.getCandidates(i).call();
        const hasVoted = await contract.methods.hasUserVoted(i, account).call();

        userVoteStatus[i] = hasVoted;

        const isCompleted = currentTime > Number(session.endTime);
        fetchedSessions.push({
          id: Number(session.id),
          title: session.title,
          startTime: Number(session.startTime),
          endTime: Number(session.endTime),
          status: session.isActive
            ? isCompleted
              ? 'Completed'
              : currentTime < Number(session.startTime)
              ? 'Not Started'
              : 'Active'
            : 'Inactive',
          hasVoted,
          candidates: candidates.map((candidate, index) => ({
            id: index,
            name: candidate.name,
            votes: candidate.voteCount,
          })),
        });
      }

      // Filter sessions to display only "Not Started" or "Active" sessions
      const filteredSessions = fetchedSessions.filter(
        (session) => session.status === 'Not Started' || session.status === 'Active'
      );

      // Sort sessions by their status
      filteredSessions.sort((a, b) => {
        const statusOrder = { Active: 1, 'Not Started': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

      setSessions(filteredSessions); // Update state with fetched sessions
      setUserVotes(userVoteStatus); // Update user's vote status
      console.log('Filtered and Sorted Sessions:', filteredSessions);
    } catch (err) {
      handleError('Failed to fetch sessions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Allows the user to vote for a candidate in a specified session.
   * @param {number} sessionId - ID of the voting session
   * @param {number} candidateId - ID of the candidate
   */
  const voteForCandidate = async (sessionId, candidateId) => {
    try {
      setLoading(true);
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];

      const contract = new web3.eth.Contract(contractABI, contractAddress);

      console.log(`Voting for candidate ID ${candidateId} in session ID ${sessionId}...`);

      const tx = await contract.methods.vote(sessionId, candidateId).send({ from: account });
      console.log('Vote transaction hash:', tx.transactionHash);

      await fetchSessions(); // Refresh sessions after voting
    } catch (err) {
      handleError('Failed to vote: ' + err.message);
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
      setError('');
    }, 3000);
  };

  /**
   * Effect hook to connect the wallet and fetch sessions on component mount.
   */
  useEffect(() => {
    connectWallet();

    if (window.ethereum) {
      // Listen for account changes in MetaMask
      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
          setWalletConnected(false);
          setSessions([]);
        } else {
          fetchSessions();
        }
      });
    }

    // Cleanup listener on component unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', fetchSessions);
      }
    };
  }, []);

  return (
    <div className="container mt-5">
      <h1 className="text-center">Voting Page</h1>

      {/* Loading modal */}
      {loading && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Processing, please wait...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Display wallet connection prompt */}
      {!walletConnected ? (
        <div className="text-center">
          <p>Connect your wallet to interact with the dApp.</p>
          <button className="btn btn-primary" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {error && <div className="alert alert-danger">{error}</div>}
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <div className="card mb-4" key={session.id}>
                <div className="card-body">
                  <h3 className="card-title">
                    {session.title}{' '}
                    <span
                      className={`badge bg-${
                        session.status === 'Not Started'
                          ? 'secondary'
                          : session.status === 'Active'
                          ? 'info'
                          : 'success'
                      }`}
                    >
                      {session.status}
                    </span>
                  </h3>
                  <p>
                    <strong>Start:</strong>{' '}
                    {new Date(session.startTime * 1000).toLocaleString()} <br />
                    <strong>End:</strong>{' '}
                    {new Date(session.endTime * 1000).toLocaleString()}
                  </p>
                  {session.hasVoted && (
                    <p className="text-success">Your vote has been successfully cast.</p>
                  )}
                  <ul className="list-group">
                    {session.candidates.map((candidate) => (
                      <li
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        key={candidate.id}
                      >
                        <span>
                          {candidate.name} {candidate.votes}
                        </span>
                        {session.status === 'Active' && !session.hasVoted && (
                          <button
                            className="btn btn-success"
                            onClick={() => voteForCandidate(session.id, candidate.id)}
                          >
                            Vote
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          ) : (
            <div className="alert alert-info text-center">
              No voting sessions available.
            </div>
          )}

          {/* Legal Considerations */}
          <div className="card bg-light mb-4">
            <div className="card-body">
              <h5 className="card-title">Legal Considerations</h5>
              <p className="card-text">
                This voting application uses blockchain technology to ensure transparency and
                immutability of records.
              </p>
              <p className="card-text">
                Please note!
              </p>
              <ul>
                <li>
                  <strong>Transparency:</strong> All transactions are stored publicly on the
                  blockchain and cannot be altered or deleted.
                </li>
                <li>
                  <strong>Privacy:</strong> Your wallet address is visible on the blockchain, but no
                  personal information is stored by this application.
                </li>
                <li>
                  <strong>GDPR Compliance:</strong> By participating, you acknowledge that
                  blockchain data cannot be modified or erased, as per the decentralized nature of
                  the technology.
                </li>
              </ul>
              <p className="p-3 mb-2 bg-light text-dark">
                Ensure that you understand and accept these terms before participating in the
                voting process.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VotingPage;