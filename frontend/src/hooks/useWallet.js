import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEthereum,
  getWeb3,
  normalizeChainId,
  SEPOLIA_CHAIN_ID_HEX,
} from "../utils/web3";

const WALLET_DISCONNECTED_EVENT = "wallet:disconnected";

const readChainId = async () => {
  const ethereum = getEthereum();
  return ethereum.request({ method: "eth_chainId" });
};

export const useWallet = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [walletError, setWalletError] = useState("");

  const clearWalletState = useCallback(() => {
    setWalletConnected(false);
    setAccount("");
    setChainId("");
    setWalletError("");
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      const web3 = getWeb3();
      const accounts = await web3.eth.requestAccounts();
      const nextChainId = await readChainId();

      setAccount(accounts?.[0] || "");
      setWalletConnected(accounts.length > 0);
      setChainId(normalizeChainId(nextChainId));
      setWalletError("");
    } catch (err) {
      setWalletError(err.message || "Failed to connect wallet.");
      clearWalletState();
    }
  }, [clearWalletState]);

  const disconnectWallet = useCallback(async () => {
    try {
      const ethereum = getEthereum();
      try {
        await ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Some wallets do not support revoke; still clear local app state.
      }
    } catch {
      // If no provider exists, we still reset local state.
    }

    clearWalletState();
    window.dispatchEvent(new Event(WALLET_DISCONNECTED_EVENT));
  }, [clearWalletState]);

  useEffect(() => {
    let isMounted = true;

    const hydrateWallet = async () => {
      try {
        const web3 = getWeb3();
        const accounts = await web3.eth.getAccounts();
        const hasAccount = accounts.length > 0;
        const nextChainId = hasAccount ? await readChainId() : "";

        if (!isMounted) {
          return;
        }

        setAccount(accounts?.[0] || "");
        setWalletConnected(hasAccount);
        setChainId(normalizeChainId(nextChainId));
      } catch (err) {
        console.error("Failed to hydrate wallet:", err);
        if (!isMounted) {
          return;
        }

        setWalletConnected(false);
      }
    };

    hydrateWallet();

    let ethereum;
    try {
      ethereum = getEthereum();
    } catch {
      return () => {
        isMounted = false;
      };
    }

    const handleAccountsChanged = (accounts) => {
      const nextAccount = accounts?.[0] || "";
      setAccount(nextAccount);
      setWalletConnected(Boolean(nextAccount));
      setWalletError("");
    };

    const handleChainChanged = (nextChainId) => {
      setChainId(normalizeChainId(nextChainId));
      setWalletError("");
    };

    const handleLocalDisconnect = () => {
      clearWalletState();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    window.addEventListener(WALLET_DISCONNECTED_EVENT, handleLocalDisconnect);

    return () => {
      isMounted = false;
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
      window.removeEventListener(
        WALLET_DISCONNECTED_EVENT,
        handleLocalDisconnect,
      );
    };
  }, [clearWalletState]);

  const isWrongNetwork = useMemo(
    () =>
      walletConnected &&
      chainId &&
      chainId !== normalizeChainId(SEPOLIA_CHAIN_ID_HEX),
    [walletConnected, chainId],
  );

  const hasResolvedChainId = useMemo(
    () => !walletConnected || Boolean(chainId),
    [walletConnected, chainId],
  );

  return {
    walletConnected,
    account,
    chainId,
    hasResolvedChainId,
    walletError,
    isWrongNetwork,
    connectWallet,
    disconnectWallet,
  };
};
