import votingContractAbi from "../generated/VotingContract.abi.json";

const DEFAULT_CONTRACT_ADDRESS = "0x6787B44FdC6Cc82126C4244FF4f2a61212359374";

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
