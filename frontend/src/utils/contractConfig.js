import votingContractAbi from "../generated/VotingContract.abi.json";

const DEFAULT_CONTRACT_ADDRESS = "0xDB2F8c3d1509858Df5Fe49fb9909f32E7E48948B";

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
