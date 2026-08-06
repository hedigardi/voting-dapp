import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";

const { mockConnectWallet } = vi.hoisted(() => ({ mockConnectWallet: vi.fn() }));

vi.mock("../hooks/useWallet", () => ({
  useWallet: () => ({
    walletConnected: false,
    account: "",
    isWrongNetwork: false,
    connectWallet: mockConnectWallet,
    disconnectWallet: vi.fn(),
  }),
}));

describe("Header", () => {
  beforeEach(() => {
    mockConnectWallet.mockClear();
  });

  it("shows the main navigation on a public session route (kiosk lock removed)", () => {
    render(
      <MemoryRouter initialEntries={["/s/3"]}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Voting" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin Panel" })).toBeInTheDocument();
  });

  it("brand link always points home", () => {
    render(
      <MemoryRouter initialEntries={["/s/3"]}>
        <Header />
      </MemoryRouter>,
    );

    const brand = screen.getByRole("link", {
      name: /Voting DApp On-chain voting/i,
    });
    expect(brand).toHaveAttribute("href", "/");
  });

  it("shows a connect wallet button when no wallet is connected", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /connect wallet/i }),
    ).toBeInTheDocument();
  });
});
