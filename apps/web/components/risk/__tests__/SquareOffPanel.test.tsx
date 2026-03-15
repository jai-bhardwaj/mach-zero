import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SymbolState } from "@/types";

// Mock hooks
const mockSquareOff = vi.fn();
vi.mock("@/hooks/useSquareOff", () => ({
  useSquareOff: vi.fn(() => ({
    squareOff: mockSquareOff,
    loading: false,
    result: null,
  })),
}));

const mockUsePositions = vi.fn((): { symbols: SymbolState[]; connected: boolean } => ({
  symbols: [],
  connected: false,
}));
vi.mock("@/hooks/usePositions", () => ({
  usePositions: () => mockUsePositions(),
}));

import { SquareOffPanel } from "../SquareOffPanel";
import { useSquareOff } from "@/hooks/useSquareOff";

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePositions.mockReturnValue({ symbols: [], connected: false });
  vi.mocked(useSquareOff).mockReturnValue({
    squareOff: mockSquareOff,
    loading: false,
    result: null,
  });
});

describe("SquareOffPanel", () => {
  describe("no open positions", () => {
    it("renders square off button when no positions", () => {
      render(<SquareOffPanel />);

      const button = screen.getByText("Square Off All & Pause Strategies");
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it("does not show position summary", () => {
      render(<SquareOffPanel />);

      expect(screen.queryByText("BTCUSDT")).not.toBeInTheDocument();
    });
  });

  describe("with open positions", () => {
    beforeEach(() => {
      mockUsePositions.mockReturnValue({
        symbols: [
          { symbolId: 1, name: "BTCUSDT", position: 500, venue: "Binance", lastPrice: 0, lastQuantity: 0, bidPrice: 0, bidQuantity: 0, askPrice: 0, askQuantity: 0, vwap: 0, volume24h: 0, unrealizedPnl: 0, realizedPnl: 0, orderCount: 0, fillCount: 0, spread: 0, lastTradeTimestamp: 0, lastUpdateTimestamp: 0 },
          { symbolId: 2, name: "ETHUSDT", position: -200, venue: "Binance", lastPrice: 0, lastQuantity: 0, bidPrice: 0, bidQuantity: 0, askPrice: 0, askQuantity: 0, vwap: 0, volume24h: 0, unrealizedPnl: 0, realizedPnl: 0, orderCount: 0, fillCount: 0, spread: 0, lastTradeTimestamp: 0, lastUpdateTimestamp: 0 },
          { symbolId: 3, name: "SOLUSDT", position: 0, venue: "Binance", lastPrice: 0, lastQuantity: 0, bidPrice: 0, bidQuantity: 0, askPrice: 0, askQuantity: 0, vwap: 0, volume24h: 0, unrealizedPnl: 0, realizedPnl: 0, orderCount: 0, fillCount: 0, spread: 0, lastTradeTimestamp: 0, lastUpdateTimestamp: 0 },
        ],
        connected: true,
      });
    });

    it("renders button with position count", () => {
      render(<SquareOffPanel />);

      expect(screen.getByText(/Square Off All \(2 positions\)/)).toBeInTheDocument();
    });

    it("shows open positions summary with symbol names", () => {
      render(<SquareOffPanel />);

      expect(screen.getByText("BTCUSDT")).toBeInTheDocument();
      expect(screen.getByText("ETHUSDT")).toBeInTheDocument();
      // SOLUSDT has position 0, should not show
      expect(screen.queryByText("SOLUSDT")).not.toBeInTheDocument();
    });

    it("shows badge with position count", () => {
      render(<SquareOffPanel />);

      expect(screen.getByText("2 open positions")).toBeInTheDocument();
    });
  });

  describe("confirmation flow", () => {
    beforeEach(() => {
      mockUsePositions.mockReturnValue({
        symbols: [
          { symbolId: 1, name: "BTCUSDT", position: 500, venue: "Binance", lastPrice: 0, lastQuantity: 0, bidPrice: 0, bidQuantity: 0, askPrice: 0, askQuantity: 0, vwap: 0, volume24h: 0, unrealizedPnl: 0, realizedPnl: 0, orderCount: 0, fillCount: 0, spread: 0, lastTradeTimestamp: 0, lastUpdateTimestamp: 0 },
        ],
        connected: true,
      });
    });

    it("shows confirmation input after clicking Square Off All", async () => {
      const user = userEvent.setup();
      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));

      expect(screen.getByPlaceholderText("Type SQUARE OFF")).toBeInTheDocument();
    });

    it("keeps Confirm button disabled until user types SQUARE OFF", async () => {
      const user = userEvent.setup();
      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));

      const confirmBtn = screen.getByText("CONFIRM SQUARE OFF ALL");
      expect(confirmBtn).toBeDisabled();

      // Type partial text
      await user.type(screen.getByPlaceholderText("Type SQUARE OFF"), "SQUARE");
      expect(confirmBtn).toBeDisabled();
    });

    it("enables Confirm button when user types exact text", async () => {
      const user = userEvent.setup();
      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));
      await user.type(screen.getByPlaceholderText("Type SQUARE OFF"), "SQUARE OFF");

      const confirmBtn = screen.getByText("CONFIRM SQUARE OFF ALL");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("calls squareOff with scope=tenant on confirm", async () => {
      const user = userEvent.setup();
      mockSquareOff.mockResolvedValue({ success: true, symbolsSquaredOff: 1 });
      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));
      await user.type(screen.getByPlaceholderText("Type SQUARE OFF"), "SQUARE OFF");
      await user.click(screen.getByText("CONFIRM SQUARE OFF ALL"));

      expect(mockSquareOff).toHaveBeenCalledWith({
        scope: "tenant",
        activateKillSwitch: true,
      });
    });

    it("Cancel clears confirmation state", async () => {
      const user = userEvent.setup();
      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));
      expect(screen.getByPlaceholderText("Type SQUARE OFF")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));
      expect(screen.queryByPlaceholderText("Type SQUARE OFF")).not.toBeInTheDocument();
    });
  });

  describe("result display", () => {
    beforeEach(() => {
      mockUsePositions.mockReturnValue({
        symbols: [
          { symbolId: 1, name: "BTCUSDT", position: 500, venue: "Binance", lastPrice: 0, lastQuantity: 0, bidPrice: 0, bidQuantity: 0, askPrice: 0, askQuantity: 0, vwap: 0, volume24h: 0, unrealizedPnl: 0, realizedPnl: 0, orderCount: 0, fillCount: 0, spread: 0, lastTradeTimestamp: 0, lastUpdateTimestamp: 0 },
        ],
        connected: true,
      });
    });

    it("shows success result", async () => {
      const user = userEvent.setup();
      mockSquareOff.mockResolvedValue({
        success: true,
        scope: "tenant",
        symbolsSquaredOff: 1,
        strategiesPaused: 2,
        killSwitchActivated: true,
        details: [],
        source: "cpp",
      });

      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));
      await user.type(screen.getByPlaceholderText("Type SQUARE OFF"), "SQUARE OFF");
      await user.click(screen.getByText("CONFIRM SQUARE OFF ALL"));

      expect(await screen.findByText("Square-Off Complete")).toBeInTheDocument();
      expect(screen.getByText(/Symbols squared off: 1/)).toBeInTheDocument();
      expect(screen.getByText(/Strategies paused: 2/)).toBeInTheDocument();
    });

    it("shows failure result", async () => {
      const user = userEvent.setup();
      mockSquareOff.mockResolvedValue({
        success: false,
        scope: "tenant",
        symbolsSquaredOff: 0,
        strategiesPaused: 0,
        killSwitchActivated: false,
        details: [],
        source: "error",
      });

      render(<SquareOffPanel />);

      await user.click(screen.getByRole("button", { name: /Square Off All/ }));
      await user.type(screen.getByPlaceholderText("Type SQUARE OFF"), "SQUARE OFF");
      await user.click(screen.getByText("CONFIRM SQUARE OFF ALL"));

      expect(await screen.findByText("Square-Off Failed")).toBeInTheDocument();
    });
  });
});
