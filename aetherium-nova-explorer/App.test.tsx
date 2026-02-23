import React from "react";
import { render, screen, act } from "@testing-library/react";
import App from "./App";
import { nodeService } from "./services/nodeService";

// Mock the nodeService
jest.mock("./services/nodeService", () => ({
  nodeService: {
    getNetworkState: jest.fn(),
    createWallet: jest.fn(),
    submitTransaction: jest.fn(),
    claimRewards: jest.fn(),
    getWalletState: jest.fn(),
    // Add any other functions that are called in App.tsx
  },
}));

describe("App", () => {
  beforeEach(() => {
    // Reset mocks before each test
    (nodeService.getNetworkState as jest.Mock).mockClear();

    // Provide a default mock implementation for getNetworkState
    (nodeService.getNetworkState as jest.Mock).mockResolvedValue({
      stats: {
        blockHeight: 1,
        tps: 0,
        activeNodes: 1,
      },
      mempool: [],
      blocks: [],
      validators: [],
    });
  });

  test("renders main heading and syncs with the node", async () => {
    render(<App />);

    // Initial render shows syncing message
    expect(
      screen.getByText(/Syncing with the network.../i)
    ).toBeInTheDocument();

    // Wait for the component to sync
    await act(async () => {
      // Wait for the state update after the initial sync
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // After sync, the main heading should be visible
    const headingElement = await screen.findByText(
      /The Next Leap in Digital Freedom/i
    );
    expect(headingElement).toBeInTheDocument();

    // And the syncing message should be gone
    expect(
      screen.queryByText(/Syncing with the network.../i)
    ).not.toBeInTheDocument();

    // Check if getNetworkState was called
    expect(nodeService.getNetworkState).toHaveBeenCalled();
  });
});
