import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const VotingContractModule = buildModule('VotingContractModule', (m) => {
  const votingContract = m.contract('VotingContract', []);

  return { votingContract };
});

export default VotingContractModule;