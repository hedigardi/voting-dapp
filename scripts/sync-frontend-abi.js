const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const artifactPath = path.join(
  rootDir,
  "artifacts",
  "contracts",
  "VotingContract.sol",
  "VotingContract.json",
);
const outputDir = path.join(rootDir, "frontend", "src", "generated");
const outputPath = path.join(outputDir, "VotingContract.abi.json");

if (!fs.existsSync(artifactPath)) {
  throw new Error(
    `Missing artifact: ${artifactPath}. Run \"npm run compile\" first.`,
  );
}

const artifactRaw = fs.readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactRaw);

if (!Array.isArray(artifact.abi)) {
  throw new Error("Artifact does not contain a valid abi array.");
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(artifact.abi, null, 2)}\n`,
  "utf8",
);

console.log(`Synced ABI to ${outputPath}`);
