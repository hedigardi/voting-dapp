import votingContractAbi from "../generated/VotingContract.abi.json";

const DEFAULT_CONTRACT_ADDRESS = "0xd8eb00a7c30A5de84732719137529db6e06BdD76";

const readEnvValue = (key, fallbackValue = "") => {
  const value = import.meta.env?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallbackValue;
};

export const contractAddress = readEnvValue(
  "VITE_CONTRACT_ADDRESS",
  DEFAULT_CONTRACT_ADDRESS,
);

if (!Array.isArray(votingContractAbi)) {
  throw new Error("VotingContract ABI is missing or malformed.");
}

export const contractABI = votingContractAbi;
