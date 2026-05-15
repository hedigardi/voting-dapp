import Web3 from "web3";
import { contractABI, contractAddress } from "./contractConfig";

// Optimism Sepolia (chain ID 11155420 = 0xaa37dc)
export const SEPOLIA_CHAIN_ID_HEX = "0xaa37dc";
export const CHAIN_NAME = "Optimism Sepolia";
const CHAIN_RPC_URLS = ["https://sepolia.optimism.io"];
const CHAIN_BLOCK_EXPLORER_URLS = ["https://sepolia-optimism.etherscan.io"];

export const normalizeChainId = (chainId = "") => {
  if (chainId === null || chainId === undefined || chainId === "") {
    return "";
  }

  if (typeof chainId === "number") {
    return `0x${chainId.toString(16)}`.toLowerCase();
  }

  const normalized = String(chainId).trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("0x")) {
    const parsedHex = Number.parseInt(normalized, 16);
    return Number.isFinite(parsedHex)
      ? `0x${parsedHex.toString(16)}`.toLowerCase()
      : normalized;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (Number.isFinite(parsed)) {
    return `0x${parsed.toString(16)}`.toLowerCase();
  }

  return normalized;
};

// Gitcoin Passport Decoder on Optimism Sepolia
const PASSPORT_DECODER_ADDRESS = "0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56";
const PASSPORT_DECODER_ABI = [
  {
    inputs: [{ internalType: "address", name: "userAddress", type: "address" }],
    name: "isHuman",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

export const getEthereum = () => {
  const injectedProvider = window.ethereum;

  if (!injectedProvider) {
    throw new Error(
      "No Web3 wallet detected. Please install a wallet extension (e.g. MetaMask) to continue.",
    );
  }

  if (Array.isArray(injectedProvider.providers)) {
    const metaMaskProvider = injectedProvider.providers.find(
      (provider) => provider?.isMetaMask,
    );

    if (metaMaskProvider) {
      return metaMaskProvider;
    }

    return injectedProvider.providers[0] || injectedProvider;
  }

  return injectedProvider;
};

export const getWeb3 = () => new Web3(getEthereum());

export const switchToSupportedNetwork = async () => {
  const ethereum = getEthereum();

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
    return;
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }
  }

  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: SEPOLIA_CHAIN_ID_HEX,
        chainName: CHAIN_NAME,
        nativeCurrency: {
          name: "ETH",
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: CHAIN_RPC_URLS,
        blockExplorerUrls: CHAIN_BLOCK_EXPLORER_URLS,
      },
    ],
  });
};

export const assertCanSendTransaction = async (account) => {
  if (!account) {
    throw new Error("No connected wallet account available.");
  }

  const ethereum = getEthereum();
  const detectedChainId = normalizeChainId(
    await ethereum.request({ method: "eth_chainId" }),
  );
  const expectedChainId = normalizeChainId(SEPOLIA_CHAIN_ID_HEX);

  if (detectedChainId !== expectedChainId) {
    throw new Error(
      `Wrong network for transaction. Expected ${CHAIN_NAME} (${expectedChainId}), detected ${detectedChainId || "unknown"}.`,
    );
  }

  const web3 = getWeb3();
  const rawBalance = await web3.eth.getBalance(account);
  const hasPositiveBalance = !!rawBalance && !/^0+$/.test(String(rawBalance));

  if (!hasPositiveBalance) {
    throw new Error(
      `Insufficient gas funds on ${CHAIN_NAME}. Add OP Sepolia ETH from a faucet before sending transactions.`,
    );
  }

  // Prevent nonce-collision replacement errors by ensuring there are no stuck pending txs.
  const latestNonce = await web3.eth.getTransactionCount(account, "latest");
  const pendingNonce = await web3.eth.getTransactionCount(account, "pending");

  if (pendingNonce > latestNonce) {
    throw new Error(
      `You have pending transactions in your wallet (${pendingNonce - latestNonce}). Confirm, speed up, or cancel them in MetaMask before sending a new transaction.`,
    );
  }
};

export const getContract = () => {
  const web3 = getWeb3();
  return new web3.eth.Contract(contractABI, contractAddress);
};

export const getPrimaryAccount = async () => {
  const web3 = getWeb3();
  const accounts = await web3.eth.getAccounts();
  return accounts?.[0] || "";
};

/**
 * Check if a wallet address holds a valid Gitcoin Passport (score >= 20).
 * Calls the on-chain Decoder contract on Optimism Sepolia.
 * @param {string} address - The voter's wallet address
 * @returns {Promise<boolean>} true if the address passes the humanity check
 */
export const checkPassportIsHuman = async (address) => {
  try {
    const web3 = getWeb3();
    const decoder = new web3.eth.Contract(
      PASSPORT_DECODER_ABI,
      PASSPORT_DECODER_ADDRESS,
    );
    return await decoder.methods.isHuman(address).call();
  } catch {
    // Some decoder states revert when the address has no score/attestation yet.
    return false;
  }
};

const getNestedMessage = (err) => {
  if (!err) return "";

  const direct = typeof err === "string" ? err : err.message;
  if (direct) return direct;

  return (
    getNestedMessage(err?.data?.originalError) ||
    getNestedMessage(err?.data) ||
    getNestedMessage(err?.cause) ||
    ""
  );
};

export const parseWeb3ErrorMessage = (
  err,
  fallback = "Transaction failed.",
) => {
  const raw = getNestedMessage(err);
  if (!raw) return fallback;

  const knownPrefixes = [
    "Returned error:",
    "execution reverted:",
    "VM Exception while processing transaction: revert",
  ];

  let normalized = raw;
  knownPrefixes.forEach((prefix) => {
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      normalized = normalized.slice(prefix.length).trim();
    }
  });

  if (/internal json-rpc error/i.test(normalized)) {
    return fallback;
  }

  if (/replacement transaction underpriced/i.test(normalized)) {
    return "MetaMask still has a pending transaction with the same nonce. Open MetaMask activity and Speed Up or Cancel the pending tx, then try again.";
  }

  return normalized || fallback;
};

export const isReplacementUnderpricedError = (err) => {
  const raw = getNestedMessage(err);
  return /replacement transaction underpriced|replacement fee too low|transaction underpriced/i.test(
    raw || "",
  );
};

const bumpWeiString = (weiValue, factor) => {
  const asNumber = Number(weiValue);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return weiValue;
  }

  return String(Math.ceil(asNumber * factor));
};

export const getRecommendedSendOptions = async (account, bump = false) => {
  const web3 = getWeb3();
  const gasPrice = await web3.eth.getGasPrice();
  const pendingNonce = await web3.eth.getTransactionCount(account, "pending");
  const bumpFactor = bump ? 1.6 : 1;

  return {
    from: account,
    nonce: pendingNonce,
    gasPrice: bumpWeiString(gasPrice, bumpFactor),
  };
};

export const shortenAddress = (address = "") => {
  if (!address || address.length < 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getVoteCacheKey = (sessionId, account) => {
  if (sessionId === null || sessionId === undefined || !account) {
    return "";
  }

  return `voteSelection:${String(sessionId)}:${String(account).toLowerCase()}`;
};

const getPendingVoteCacheKey = (sessionId, account) => {
  if (sessionId === null || sessionId === undefined || !account) {
    return "";
  }

  return `pendingVoteSelection:${String(sessionId)}:${String(account).toLowerCase()}`;
};

export const cacheVotedCandidate = (sessionId, account, candidateId) => {
  const key = getVoteCacheKey(sessionId, account);
  if (!key || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, String(candidateId));
  } catch {
    // Ignore storage errors and keep UI functional without cache.
  }
};

export const getCachedVotedCandidate = (sessionId, account) => {
  const key = getVoteCacheKey(sessionId, account);
  if (!key || typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === "") {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const setPendingVotedCandidate = (sessionId, account, candidateId) => {
  const key = getPendingVoteCacheKey(sessionId, account);
  if (!key || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, String(candidateId));
  } catch {
    // Ignore storage errors and keep UI functional without pending cache.
  }
};

export const getPendingVotedCandidate = (sessionId, account) => {
  const key = getPendingVoteCacheKey(sessionId, account);
  if (!key || typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === "") {
      return null;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearPendingVotedCandidate = (sessionId, account) => {
  const key = getPendingVoteCacheKey(sessionId, account);
  if (!key || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
};

const buildVoteEventFromBlocks = (latestBlock) => {
  const lookbacks = [2500, 20000, 100000, 500000, 1500000];
  const blocks = lookbacks.map((windowSize) =>
    Math.max(Number(latestBlock) - windowSize, 0),
  );

  // Final fallback for providers that only return older logs with full history queries.
  blocks.push(0);

  return [...new Set(blocks)];
};

export const resolveVotedCandidateFromEvents = async (
  contract,
  account,
  sessionId,
) => {
  if (!contract || !account || sessionId === null || sessionId === undefined) {
    return null;
  }

  let fromBlocks = [0];
  try {
    const web3 = getWeb3();
    const latestBlock = await web3.eth.getBlockNumber();
    fromBlocks = buildVoteEventFromBlocks(latestBlock);
  } catch {
    // Keep full-history fallback if block number RPC fails.
  }

  let lastError = null;
  const normalizedSessionId = Number(sessionId);

  for (const fromBlock of fromBlocks) {
    try {
      const voteEvents = await contract.getPastEvents("VoteCast", {
        filter: { voter: account, sessionId: normalizedSessionId },
        fromBlock,
        toBlock: "latest",
      });

      if (voteEvents.length > 0) {
        const latestEvent = voteEvents[voteEvents.length - 1];
        const candidateId = Number(latestEvent.returnValues.candidateId);
        return Number.isFinite(candidateId) ? candidateId : null;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    console.warn(
      `Could not resolve VoteCast event for session ${normalizedSessionId}:`,
      lastError,
    );
  }

  return null;
};

export const sortSessionsByRecency = (sessions = []) =>
  [...sessions].sort(
    (a, b) =>
      Number(b?.endTime || 0) - Number(a?.endTime || 0) ||
      Number(b?.startTime || 0) - Number(a?.startTime || 0) ||
      Number(b?.id || 0) - Number(a?.id || 0),
  );
