const hre = require("hardhat");

async function main() {
  const VotingContract = await hre.ethers.getContractFactory("VotingContract");
  const votingContract = await VotingContract.deploy();

  await votingContract.waitForDeployment();

  console.log("VotingContract deployed to:", votingContract.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
