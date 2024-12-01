import { HardhatUserConfig, vars } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const ETHERSCAN_API_KEY = vars.get('ETHERSCAN_API_KEY');
const ALCHEMY_API_KEY = vars.get('ALCHEMY_API_KEY');
const SEPOLIA_PRIVATE_KEY = vars.get('SEPOLIA_PRIVATE_KEY'); 

const config: HardhatUserConfig = {
  solidity: '0.8.28', 

  etherscan: {
    apiKey: ETHERSCAN_API_KEY, 
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: true, 
      mining: {
        auto: true,
        interval: 0,
      },
      blockGasLimit: 12000000, 
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
  },

  sourcify: {
    enabled: true,
  },
};

export default config;