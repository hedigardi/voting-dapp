import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const readVar = (name: string) => (vars.has(name) ? vars.get(name) : "");

// Optional for local compile/test, required for live deployment/verification.
const ETHERSCAN_API_KEY = readVar("ETHERSCAN_API_KEY");
const ALCHEMY_API_KEY = readVar("ALCHEMY_API_KEY");
const SEPOLIA_PRIVATE_KEY = readVar("SEPOLIA_PRIVATE_KEY");
const hasDeploySecrets = Boolean(ALCHEMY_API_KEY && SEPOLIA_PRIVATE_KEY);

// Hardhat configuration object
const config: HardhatUserConfig = {
  solidity: "0.8.28", // Solidity compiler version

  // Etherscan configuration for contract verification (supports multiple chains)
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      optimismSepolia: ETHERSCAN_API_KEY,
    },
  },

  // Network configurations
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true, // Allow larger contracts during testing
      mining: {
        auto: true, // Enable automatic mining of blocks
        interval: 0, // Disable block mining delay for faster tests
      },
      blockGasLimit: 12000000, // Increase block gas limit for larger transactions
    },
    ...(hasDeploySecrets
      ? {
          sepolia: {
            url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
          },
          optimismSepolia: {
            url: `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            accounts: [SEPOLIA_PRIVATE_KEY],
            chainId: 11155420,
          },
        }
      : {}),
  },

  // Sourcify configuration for source code verification
  sourcify: {
    enabled: true, // Automatically verifies source code on Sourcify
  },
};

export default config;
