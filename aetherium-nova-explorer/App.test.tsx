import React from "react";
import { render, waitFor } from "@testing-library/react";
import App from "./App";
import { nodeService } from "./services/nodeService";

// Stub every named-export component so tests run without browser APIs.
// Each factory is self-contained (jest.fn is in scope for jest.mock factories).
jest.mock("./components/Hero", () => ({ Hero: jest.fn(() => null) }));
jest.mock("./components/Header", () => ({ Header: jest.fn(() => null) }));
jest.mock("./components/Footer", () => ({ Footer: jest.fn(() => null) }));
jest.mock("./components/NetworkStats", () => ({
  NetworkStats: jest.fn(() => null),
}));
jest.mock("./components/NetworkExplorer", () => ({
  NetworkExplorer: jest.fn(() => null),
}));
jest.mock("./components/WalletPage", () => ({
  WalletPage: jest.fn(() => null),
}));
jest.mock("./components/StakingPage", () => ({
  StakingPage: jest.fn(() => null),
}));
jest.mock("./components/CliPage", () => ({ CliPage: jest.fn(() => null) }));
jest.mock("./components/WhitepaperModal", () => ({
  WhitepaperModal: jest.fn(() => null),
}));
jest.mock("./components/ConceptCard", () => ({
  ConceptCard: jest.fn(() => null),
}));
jest.mock("./components/icons/LockIcon", () => ({
  LockIcon: jest.fn(() => null),
}));
jest.mock("./components/icons/CubeIcon", () => ({
  CubeIcon: jest.fn(() => null),
}));
jest.mock("./components/icons/CpuIcon", () => ({
  CpuIcon: jest.fn(() => null),
}));
jest.mock("./components/icons/NetworkIcon", () => ({
  NetworkIcon: jest.fn(() => null),
}));
jest.mock("./components/icons/ShieldIcon", () => ({
  ShieldIcon: jest.fn(() => null),
}));
jest.mock("./components/icons/RocketIcon", () => ({
  RocketIcon: jest.fn(() => null),
}));

// Prevent live network calls
jest.mock("./services/nodeService", () => ({
  nodeService: {
    getNetworkState: jest.fn(),
    createWallet: jest.fn(),
    submitTransaction: jest.fn(),
    claimRewards: jest.fn(),
    getWalletState: jest.fn(),
  },
}));

describe("App", () => {
  beforeEach(() => {
    (nodeService.getNetworkState as jest.Mock).mockClear();
    (nodeService.getNetworkState as jest.Mock).mockResolvedValue({
      stats: { blockHeight: 1, tps: 0, activeNodes: 1 },
      mempool: [],
      blocks: [],
      validators: [],
    });
  });

  test("mounts without crashing and calls getNetworkState", async () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    await waitFor(
      () => {
        expect(nodeService.getNetworkState).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });
});
