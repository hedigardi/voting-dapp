import React, { useEffect, useState } from 'react';
import Web3 from 'web3';

const VotingPage = () => {
  const [walletConnected, setWalletConnected] = useState(false);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      console.log('Connected account:', accounts[0]);
      setWalletConnected(true);
    } catch (err) {
      console.error('Failed to connect wallet:', err.message);
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
        } else {
          setWalletConnected(false);
        }
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
      }
    };
  }, []);

  return (
    <div className="container mt-5 text-center">
      <h1>Voting Page</h1>
      {!walletConnected ? (
        <div className="text-center">
          <p>Connect your wallet to interact with the dApp.</p>
          <button className="btn btn-primary" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <p>You are now connected.</p>
      )}
    </div>
  );
};

export default VotingPage;
