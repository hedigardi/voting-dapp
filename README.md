# Voting dApp

Decentralized voting application with a Solidity smart contract (Hardhat) and React frontend.

## Usage Guidelines

The application has two distinct roles: **admin** and **voter**.

### As a voter

1. Open the app and navigate to the **Voting** page.
2. Connect your wallet (Optimism Sepolia network).
3. Browse active and upcoming sessions. Each session shows its title, candidate list, start/end time, and current status.
4. Click **Vote** next to the candidate of your choice. Confirm the transaction in your wallet.
5. Your vote is recorded on-chain. The session card updates immediately to reflect your choice.
6. Navigate to the **Results** page at any time to see live vote counts for all sessions, including completed ones and declared winners.

> Some sessions are marked as **Passport required**. These require a [Gitcoin Passport](https://passport.xyz) humanity score of 20 or higher. Verify your identity at passport.xyz before voting in those sessions.

### As an admin

The wallet that deployed the contract is the owner and has exclusive access to the **Admin Panel**.

1. Connect the owner wallet and navigate to **Admin**.
2. Create a new voting session by providing a title, start time, end time, and whether Gitcoin Passport verification is required.
3. Add candidates to the session.
4. Once the start time is reached, the session becomes active and voters can participate.
5. After the end time passes the session is marked as Completed and a winner is declared automatically on the Results page.

---

## Current Network

- Frontend target network: Optimism Sepolia (`chainId 11155420`, `0xaa37dc`)
- Deployed contract: `0xDB2F8c3d1509858Df5Fe49fb9909f32E7E48948B`
- Gitcoin Passport decoder: `0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56`

## Tech Stack

- Frontend: React 18, Vite, React Router v6, Bootstrap 5, Web3.js v4
- Smart contracts: Solidity 0.8, OpenZeppelin (Ownable, ReentrancyGuard)
- Tooling: Hardhat, TypeScript, Ignition

## Local Setup

1. Install dependencies:

```sh
npm install
npm install --prefix frontend
```

2. Optional Hardhat vars for deploy/verify:

```sh
npx hardhat vars set ALCHEMY_API_KEY
npx hardhat vars set SEPOLIA_PRIVATE_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

3. Compile the contract and sync the ABI to the frontend:

```sh
npm run compile
```

4. Run tests:

```sh
npm test
```

5. Start the dev server:

```sh
npm start --prefix frontend
# → http://localhost:5173
```

Other frontend scripts:

```sh
npm run preview --prefix frontend   # preview production build locally
npm run lint --prefix frontend       # ESLint
npm run start:prod                   # serve frontend/dist on port 3000 (fails if port is occupied)
```

## Deploy Contract (Ignition)

Deploy to Optimism Sepolia:

```sh
npx hardhat ignition deploy ignition/modules/VotingContract.ts --network optimismSepolia --verify
```

After a new deployment, update `VITE_CONTRACT_ADDRESS` in your environment or `frontend/.env.production` and re-run `npm run compile` to sync the ABI.

## Frontend Environment Variables

Create `frontend/.env.production` (or set the same keys in the Netlify UI):

```sh
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID_HEX=0xaa37dc
VITE_CHAIN_NAME=Optimism Sepolia
VITE_CHAIN_RPC_URL=https://sepolia.optimism.io
VITE_CHAIN_EXPLORER_URL=https://sepolia-optimism.etherscan.io
VITE_PASSPORT_DECODER_ADDRESS=0xe53C60F8069C2f0c3a84F9B3DB5cf56f3100ba56
```

All variables are optional — the defaults above are used as fallbacks. A reference file is available at `frontend/.env.example`.

The ABI is auto-synced from Hardhat artifacts on every `npm run compile` and `npm run build` via `scripts/sync-frontend-abi.js`.

## Netlify Deployment

The repo root contains a `netlify.toml` that configures the full build for Netlify:

- **Build command:** `npm ci --prefix frontend ; npm run compile ; npm run build --prefix frontend`
- **Publish directory:** `frontend/dist`
- **SPA redirect:** all routes fall back to `index.html` (configured in `netlify.toml`)

No manual Netlify settings are needed when deploying from the repo root; set environment variables in the Netlify UI if you want to override the defaults.

## Quality Checks

```sh
npm run lint
npm run build --prefix frontend
```

## License

MIT. See `LICENSE.md`.
