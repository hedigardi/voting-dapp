const hre = require("hardhat");

async function main() {
  const passportDecoder =
    process.env.PASSPORT_DECODER_ADDRESS ||
    "0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56";

  const VotingContract = await hre.ethers.getContractFactory("VotingContract");
  const votingContract = await VotingContract.deploy(passportDecoder);

  await votingContract.waitForDeployment();

  console.log("VotingContract deployed to:", votingContract.target);
  console.log("Passport decoder:", passportDecoder);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
