// Import the `buildModule` function from Hardhat Ignition
// `buildModule` is used to define a deployment module for Hardhat
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * A Hardhat Ignition deployment module for the `VotingContract` contract.
 * This module defines how the `VotingContract` contract is deployed and
 * facilitates its integration into the Hardhat Ignition framework.
 */

// Define the deployment module for `VotingContract`
const VotingContractModule = buildModule("VotingContractModule", (m) => {
  /**
   * Deploy the `VotingContract` contract.
   *
   * Pass the Gitcoin Passport Decoder address for Optimism Sepolia.
   * Decoder contract: https://docs.passport.xyz/building-with-passport/smart-contracts/contract-reference
   */
  const passportDecoder = m.getParameter(
    "passportDecoder",
    "0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56", // Gitcoin Passport Decoder on Optimism Sepolia
  );

  const votingContract = m.contract("VotingContract", [passportDecoder]);

  // Return the deployed contract for use in other parts of the application
  return { votingContract };
});

// Export the module so it can be used by Hardhat's Ignition framework
export default VotingContractModule;
