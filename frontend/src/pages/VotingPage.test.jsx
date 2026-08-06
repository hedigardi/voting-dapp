import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VotingPage from "./VotingPage";

const { mockConnectWallet } = vi.hoisted(() => ({ mockConnectWallet: vi.fn() }));

const contractStub = {
  methods: {
    sessionCount: () => ({ call: async () => "1" }),
    votingSessions: () => ({
      call: async () => ({
        id: "0",
        title: "Test Session",
        startTime: "0",
        endTime: "9999999999",
        isActive: true,
      }),
    }),
    getCandidates: () => ({
      call: async () => [{ name: "Alice", voteCount: "0" }],
    }),
  },
};

vi.mock("../utils/web3", () => ({
  assertCanSendTransaction: vi.fn(async () => {}),
  buildVoteEventFromBlocks: vi.fn(() => [0]),
  cacheVotedCandidate: vi.fn(),
  clearPendingVotedCandidate: vi.fn(),
  getContract: vi.fn(),
  getReadOnlyContract: () => contractStub,
  getWeb3: vi.fn(() => ({ eth: { getBlockNumber: async () => 1 } })),
  getCachedVotedCandidate: vi.fn(() => null),
  getPendingVotedCandidate: vi.fn(() => null),
  getRecommendedSendOptions: vi.fn(),
  isReplacementUnderpricedError: vi.fn(() => false),
  resolveVotedCandidateFromEvents: vi.fn(async () => null),
  setPendingVotedCandidate: vi.fn(),
  sortSessionsByRecency: (sessions) => sessions,
  CHAIN_NAME: "Optimism Sepolia",
  checkPassportIsHuman: vi.fn(async () => true),
  parseWeb3ErrorMessage: (message) => message,
  switchToSupportedNetwork: vi.fn(),
}));

vi.mock("../hooks/useWallet", () => ({
  useWallet: () => ({
    walletConnected: false,
    account: "",
    hasResolvedChainId: true,
    walletError: "",
    isWrongNetwork: false,
    connectWallet: mockConnectWallet,
  }),
}));

describe("VotingPage (public, read-only)", () => {
  beforeEach(() => {
    mockConnectWallet.mockClear();
  });

  it("renders active sessions without a connected wallet", async () => {
    render(<VotingPage />);

    expect(await screen.findByText("Test Session")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("offers a connect-to-vote action for active sessions", async () => {
    render(<VotingPage />);

    const button = await screen.findByRole("button", {
      name: "Connect to vote",
    });
    expect(button).toBeInTheDocument();
  });

  it("connects the wallet when Connect to vote is clicked", async () => {
    const user = userEvent.setup();
    render(<VotingPage />);

    const button = await screen.findByRole("button", {
      name: "Connect to vote",
    });
    await user.click(button);

    expect(mockConnectWallet).toHaveBeenCalledTimes(1);
  });
});
