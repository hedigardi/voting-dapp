import Web3 from "web3";
import { contractABI, contractAddress } from "./contractConfig";

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export const getEthereum = () => {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet detected. Please install a wallet extension (e.g. MetaMask) to continue.",
    );
  }

  return window.ethereum;
};

export const getWeb3 = () => new Web3(getEthereum());

export const getContract = () => {
  const web3 = getWeb3();
  return new web3.eth.Contract(contractABI, contractAddress);
};

export const getPrimaryAccount = async () => {
  const web3 = getWeb3();
  const accounts = await web3.eth.getAccounts();
  return accounts?.[0] || "";
};

export const shortenAddress = (address = "") => {
  if (!address || address.length < 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
