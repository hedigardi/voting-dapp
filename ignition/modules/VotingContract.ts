// Import the `buildModule` function from Hardhat Ignition
// `buildModule` is used to define a deployment module for Hardhat
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

/**
 * A Hardhat Ignition deployment module for the `VotingContract` contract.
 * This module defines how the `VotingContract` contract is deployed and 
 * facilitates its integration into the Hardhat Ignition framework.
 */

// Define the deployment module for `VotingContract`
const VotingContractModule = buildModule('VotingContractModule', (m) => {
  /**
   * Deploy the `VotingContract` contract.
   * 
   * @param {string} name - The name of the contract (`VotingContract`).
   * @param {any[]} args - Constructor arguments for the contract deployment (empty array in this case).
   * @returns {object} - A reference to the deployed contract.
   */
  const votingContract = m.contract('VotingContract', []);

  // Return the deployed contract for use in other parts of the application
  return { votingContract };
});

// Export the module so it can be used by Hardhat's Ignition framework
export default VotingContractModule;