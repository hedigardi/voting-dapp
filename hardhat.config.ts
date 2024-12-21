import { HardhatUserConfig, vars } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

// Environment variables to keep sensitive data secure
const ETHERSCAN_API_KEY = vars.get('ETHERSCAN_API_KEY'); // Etherscan API key for contract verification
const ALCHEMY_API_KEY = vars.get('ALCHEMY_API_KEY'); // Alchemy API key for connecting to Sepolia network
const SEPOLIA_PRIVATE_KEY = vars.get('SEPOLIA_PRIVATE_KEY'); // Private key for Sepolia testnet account

// Hardhat configuration object
const config: HardhatUserConfig = {
  solidity: '0.8.28', // Solidity compiler version

  // Etherscan configuration for contract verification
  etherscan: {
    apiKey: ETHERSCAN_API_KEY, // API key for interacting with Etherscan
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
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, // Alchemy endpoint for Sepolia
      accounts: [SEPOLIA_PRIVATE_KEY], // Private key for deploying contracts to Sepolia
    },
  },

  // Sourcify configuration for source code verification
  sourcify: {
    enabled: true, // Automatically verifies source code on Sourcify
  },
};

export default config;