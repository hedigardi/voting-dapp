import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { contractAddress, contractABI } from '../utils/contractConfig';

const ResultsPage = () => {
  const [sessions, setSessions] = useState([]); 
  const [error, setError] = useState('');
  const [walletConnected, setWalletConnected] = useState(false); 
  const [loading, setLoading] = useState(false); 

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed.');
      }
      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      console.log('Connected account:', accounts[0]);
      setWalletConnected(true);
      await fetchResults(); 
    } catch (err) {
      setError('Failed to connect wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed.');
      }

      setLoading(true);
      const web3 = new Web3(window.ethereum);
      const contract = new web3.eth.Contract(contractABI, contractAddress);

      const sessionCount = await contract.methods.sessionCount().call();
      console.log('Total Sessions:', sessionCount);

      const currentTime = Math.floor(Date.now() / 1000);
      const fetchedSessions = [];

      for (let i = 0; i < sessionCount; i++) {
        const session = await contract.methods.votingSessions(i).call();
        const candidates = await contract.methods.getCandidates(i).call();

        const isCompleted = currentTime > Number(session.endTime);
        const isNotStarted = currentTime < Number(session.startTime);
        let winner = null;
        let isTie = false;

        if (isCompleted && candidates.length > 0) {
          try {
            const result = await contract.methods.getWinner(i).call();
            winner = result[0];
            isTie = result[1];
          } catch (error) {
            console.error(`Error fetching winner for session ${i}:`, error.message);
          }
        }

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
          winner: candidates.length > 0 ? winner : 'No candidates',
          isTie: candidates.length > 0 && isTie,
          candidates: candidates.map((candidate, index) => ({
            id: index,
            name: candidate.name,
            votes: Number(candidate.voteCount),
          })),
        });
      }

      const statusOrder = {
        Completed: 1,
        Active: 2,
        'Not Started': 3,
        Inactive: 4,
      };

      fetchedSessions.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      setSessions(fetchedSessions);
      console.log('Sorted Sessions with Results:', fetchedSessions);
    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to fetch results: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const web3 = new Web3(window.ethereum);
          const accounts = await web3.eth.getAccounts();
          if (accounts.length > 0) {
            console.log('Wallet is already connected:', accounts[0]);
            setWalletConnected(true);
            await fetchResults();
          }
        } catch (err) {
          console.error('Error checking wallet connection:', err.message);
        }
      }
    };

    checkWalletConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          console.log('Account changed:', accounts[0]);
          setWalletConnected(true);
          fetchResults();
        } else {
          setWalletConnected(false);
          setSessions([]); 
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', fetchResults);
      }
    };
  }, []);

  return (
    <div className="container mt-5">
      <h1 className="text-center">Voting Results</h1>

      {loading && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading, please wait...</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="row">
              {sessions.map((session) => (
                <div className="col-md-6 mb-4" key={session.id}>
                  <div className="card">
                    <div className="card-body">
                      <h3 className="card-title">
                        {session.title}{' '}
                        <span
                          className={`badge bg-${
                            session.status === 'Completed'
                              ? 'success'
                              : session.status === 'Active'
                              ? 'info'
                              : 'secondary'
                          }`}
                        >
                          {session.status}
                        </span>
                      </h3>
                      <p>
                        <strong>Start:</strong> {new Date(session.startTime * 1000).toLocaleString()}
                        <br />
                        <strong>End:</strong> {new Date(session.endTime * 1000).toLocaleString()}
                      </p>
                      <ul className="list-group mb-3">
                        {session.candidates.map((candidate) => (
                          <li
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                            key={candidate.id}
                          >
                            {candidate.name}
                            <span className="badge bg-primary">
                              {candidate.votes} {candidate.votes === 1 ? 'vote' : 'votes'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {session.status === 'Completed' && (
                        <p className="text-success">
                          <strong>Winner:</strong>{' '}
                          {session.isTie ? (
                            <span className="text-danger">No clear winner (tie)</span>
                          ) : (
                            session.winner
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-info text-center">
              No sessions available.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;