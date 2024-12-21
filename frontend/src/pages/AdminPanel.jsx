import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { contractAddress, contractABI } from '../utils/contractConfig';

/**
 * AdminPanel component provides the interface for managing voting sessions and candidates.
 */
const AdminPanel = () => {
  // State variables for managing inputs and app state
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [sessions, setSessions] = useState([]); // Stores all voting sessions
  const [candidatesBySession, setCandidatesBySession] = useState({}); // Maps session IDs to their candidates
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [candidateName, setCandidateName] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // For displaying error messages
  const [successMessage, setSuccessMessage] = useState(''); // For displaying success messages
  const [walletConnected, setWalletConnected] = useState(false); // Tracks wallet connection status
  const [currentAccount, setCurrentAccount] = useState(''); // Stores the connected account
  const [loading, setLoading] = useState(false); // Tracks loading state for displaying a spinner

  // Utility function to handle error messages
  const handleError = (message) => {
    setErrorMessage(message);
    setTimeout(() => {
      setErrorMessage('');
    }, 3000);
  };

  // Utility function to handle success messages
  const handleSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  /**
   * Connects the user's wallet using MetaMask.
   */
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed.');
      }
      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      setWalletConnected(true);
      setCurrentAccount(accounts[0]);
      await fetchSessions(); // Fetch sessions after connecting
    } catch (err) {
      handleError('Failed to connect wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates a new voting session with the specified title and time range.
   */
  const createSession = async () => {
    try {
      if (!title || !startTime || !endTime) {
        throw new Error('All fields are required to create a session.');
      }

      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];

      const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);
      const endTimeUnix = Math.floor(new Date(endTime).getTime() / 1000);

      if (startTimeUnix >= endTimeUnix) {
        throw new Error('Start time must be before end time.');
      }

      const contract = new web3.eth.Contract(contractABI, contractAddress);

      // Call the smart contract method to create a session
      const tx = await contract.methods
        .createVotingSession(title, startTimeUnix, endTimeUnix)
        .send({ from: account });
      console.log('Session created. Transaction hash:', tx.transactionHash);

      await fetchSessions(); // Refresh sessions after creation
      handleSuccess('Voting session created successfully!');
    } catch (err) {
      console.error('Error creating session:', err);
      handleError('Failed to create session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches candidates for a specific voting session.
   */
  const fetchCandidates = async (sessionId) => {
    try {
      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const contract = new web3.eth.Contract(contractABI, contractAddress);

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
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches all voting sessions and their details.
   */
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const contract = new web3.eth.Contract(contractABI, contractAddress);

      const sessionCount = await contract.methods.sessionCount().call();
      const currentTime = Math.floor(Date.now() / 1000);
      const fetchedSessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const creator = await contract.methods.getSessionCreator(i).call();
        const isCompleted = currentTime > Number(session.endTime);
        const isNotStarted = currentTime < Number(session.startTime);

        fetchedSessions.push({
          id: Number(session.id),
          title: session.title,
          startTime: Number(session.startTime),
          endTime: Number(session.endTime),
          status: isCompleted
            ? 'Completed'
            : isNotStarted
            ? 'Not Started'
            : session.isActive
            ? 'Active'
            : 'Inactive',
          creator,
        });
      }

      // Sort sessions by status
      fetchedSessions.sort((a, b) => {
        const statusOrder = {
          Active: 1,
          'Not Started': 2,
          Completed: 3,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });

      setSessions(fetchedSessions);

      // Fetch candidates for each session
      for (const session of fetchedSessions) {
        fetchCandidates(session.id);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      handleError('Failed to fetch sessions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Adds a new candidate to a specific voting session.
   */
  const addCandidate = async () => {
    try {
      if (!selectedSessionId || candidateName.trim() === '') {
        throw new Error('Please select a valid session and enter a candidate name.');
      }
  
      setLoading(true);
  
      const sessionId = Number(selectedSessionId);
      if (isNaN(sessionId)) {
        throw new Error('Invalid session ID.');
      }
  
      const selectedSession = sessions.find((session) => session.id === sessionId);
      if (!selectedSession) {
        throw new Error('Selected session does not exist.');
      }
  
      const currentTime = Math.floor(Date.now() / 1000);
  
      if (currentTime > selectedSession.endTime) {
        throw new Error('You cannot add a candidate to a voting session that has already ended.');
      }
  
      if (currentTime >= selectedSession.startTime && currentTime <= selectedSession.endTime) {
        throw new Error('Candidates cannot be added during the voting period.');
      }
  
      if (selectedSession.creator.toLowerCase() !== currentAccount.toLowerCase()) {
        throw new Error('Only the creator of this voting session can add candidates.');
      }
  
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      const contract = new web3.eth.Contract(contractABI, contractAddress);
  
      const tx = await contract.methods
        .addCandidate(sessionId, candidateName)
        .send({ from: account });
  
      console.log('Candidate added. Transaction hash:', tx.transactionHash);
  
      setCandidateName('');
      await fetchCandidates(sessionId); 
      handleSuccess('Candidate added successfully!');
    } catch (err) {
      console.error('Error adding candidate:', err);
  
      handleError(err.message);
    } finally {
      setLoading(false);
    }
  };     

  // Effect to connect wallet and fetch sessions on component mount
  useEffect(() => {
    connectWallet();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          fetchSessions();
        } else {
          setWalletConnected(false);
          setCurrentAccount('');
        }
      });
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  return (
    <div className="container mt-5">
      <h1 className="text-center">Admin Panel</h1>

      {/* Loading Modal */}
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

      {/* Wallet not connected view */}
      {!walletConnected && (
        <div className="text-center">
          <p>Connect your wallet to interact with the dApp.</p>
          <button className="btn btn-primary" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      )}

      {/* Main content when wallet is connected */}
      {walletConnected && (
        <>
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

          {/* Form to create a new voting session */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="card-title">Create Voting Session</h3>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Voting Title"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Start Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">End Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <button className="btn btn-success" onClick={createSession}>
                Create Voting Session
              </button>
            </div>
          </div>

          {/* Form to add candidates */}
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="card-title">Add Candidate</h3>
              <div className="mb-3">
                <label className="form-label">Select Session</label>
                <select
                  className="form-select"
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  value={selectedSessionId || ''}
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
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="Candidate Name"
                />
              </div>
              <button className="btn btn-warning" onClick={addCandidate}>
                Add Candidate
              </button>
            </div>
          </div>

          {/* List of sessions and their candidates */}
          <div className="card">
            <div className="card-body">
              <h3 className="card-title">Sessions and Candidates</h3>
              <div className="row">
                {sessions.map((session) => (
                  <div className="col-md-6 mb-4" key={session.id}>
                    <div className="card">
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
                          {new Date(session.startTime * 1000).toLocaleString()}
                          <br />
                          <strong>End:</strong>{' '}
                          {new Date(session.endTime * 1000).toLocaleString()}
                        </p>
                        <ul className="list-group">
                          {candidatesBySession[session.id]?.length > 0 ? (
                            candidatesBySession[session.id].map((candidate) => (
                              <li
                                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                key={candidate.id}
                              >
                                {candidate.name}
                              </li>
                            ))
                          ) : (
                            <li className="list-group-item list-group-item-primary">No candidates added!</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPanel;