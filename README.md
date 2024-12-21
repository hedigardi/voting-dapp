# Voting dApp

A decentralized application (dApp) for conducting transparent and efficient voting processes on the Ethereum blockchain.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Usage Guidelines](#usage-guidelines)
- [Smart Contract Overview](#smart-contract-overview)
- [Testing](#testing)
- [License](#license)

---

## Overview

Voting dApp is a blockchain-based decentralized application that facilitates secure and transparent voting processes. The application supports the creation of voting sessions, allows participants to vote, and displays results after voting concludes.

---

## Features

- **Admin Features**:
  - Create voting sessions with start and end times.
  - Add candidates to voting sessions.
  - Archive completed voting sessions.

- **User Features**:
  - View active and upcoming voting sessions.
  - Cast votes for candidates during voting periods.
  - View voting results, including winners or ties.

- **Smart Contract**:
  - Ensures transparency and immutability.
  - Prevents duplicate voting and restricts access to authorized actions.

---

## Technologies Used
- **Frontend**: React, Bootstrap
- **Smart Contracts**: Solidity
- **Testing Framework**: Hardhat, Chai
- **Blockchain Network**: Ethereum (Sepolia Testnet)
- **Wallet Integration**: MetaMask
- **Smart Contract Interaction**: Web3.js

---

## Prerequisites

Before setting up the project, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [MetaMask](https://metamask.io/) browser extension
- [Hardhat](https://hardhat.org/) development environment

---

## Setup Instructions

### Clone the Repository
```sh
git clone https://github.com/hedigardi/test-voting.git
cd test-voting
```

### Install Dependencies
Run the following command to install all required dependencies:
```sh
npm install
cd frontend
npm install
```

### Configure Environment Variables
Create a `.env` file in the root directory with the following keys:
```sh
ALCHEMY_API_KEY=your-alchemy-api-key
SEPOLIA_PRIVATE_KEY=your-private-key
ETHERSCAN_API_KEY=your-etherscan-api-key
```

### Compile the Smart Contract
```sh
npm run compile
```

### Deploy the Smart Contract
Deploy the smart contract to the Sepolia network:
```sh
npx hardhat ignition deploy ignition/modules/{smart-contract-name}.ts --network sepolia --verify
```
Update the `contractAddress` in `src/utils/contractConfig.js` with the deployed contract address.

### Run the Development Server
Start the React frontend:
```sh
cd frontend
npm start
```
---

## Usage Guidelines
### 1. Connect Wallet
  * Users must connect their MetaMask wallet to interact with the DApp.
  * If no wallet is connected, the app prompts the user to connect.
    
### 2. Create Voting Sessions (Admin)
  * Navigate to the Admin Panel to create voting sessions.
  * Provide a title, start time, and end time for the session.
    
### 3. Add Candidates (Admin)
  * Select a session and add candidates.
  * Candidates can only be added before the session starts.
    
### 4. Cast Votes (User)
  * Users can view active voting sessions on the Voting Page and cast their votes.
  * Each user can vote only once per session.
    
### 5. View Results (All Users)
  * Completed voting sessions are visible on the Results Page, showing the winner or indicating a tie.

---

## Smart Contract Overview
The smart contract includes the following functionalities:

* Voting Session Management:
  * Create sessions with start and end times.
  * Restrict actions to session creators.

* Voting:
  * Prevent duplicate voting.
  * Support transparent result calculations.

* Result Retrieval:
  * Identify the winner or determine a tie.

The contract is written in Solidity and uses OpenZeppelin libraries for security.

---

## Testing
### Run Unit Tests
Run tests to ensure the functionality of the smart contract:
```sh
npm test
```
Sample test cases include:
* Creating voting sessions.
* Adding candidates.
* Voting during valid periods.
* Retrieving results.

### Coverage
Generate a coverage report:
```sh
npm run coverage
```
---

### License
This project is licensed under the MIT License. See the [LICENSE](https://github.com/hedigardi/voting-dapp/blob/main/LICENSE.md) file for details.
