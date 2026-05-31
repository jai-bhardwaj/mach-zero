import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StrategyConfig, SymbolState } from "@/types";
import { StrategyCard } from "../StrategyCard";

function makeStrategy(overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return {
    id: "strat-1",
    tenantId: "tenant-1",
    accountId: null,
    name: "Test Strategy",
    type: "SimpleSpreadStrategy",
    symbolId: 1,
    symbolName: "BTCUSDT",
    venue: "Binance",
    status: "PENDING",
    tradingMode: "MOCK",
    modeChangedAt: null,
    params: { spreadOffset: 100 },
    maxPositionLimit: null,
    maxOrderRate: null,
    maxDrawdown: null,
    riskMultiplier: 1.0,
    updatedAt: "2026-01-01T00:00:00Z",
    updatedBy: null,
    ...overrides,
  };
}

function makeLiveData(overrides: Partial<SymbolState> = {}): SymbolState {
  return {
    symbolId: 1,
    name: "BTCUSDT",
    venue: "Binance",
    lastPrice: 68500,
    lastQuantity: 0.5,
    bidPrice: 68490,
    bidQuantity: 1.2,
    askPrice: 68510,
    askQuantity: 0.8,
    vwap: 68450,
    volume24h: 12000,
    position: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    orderCount: 0,
    fillCount: 0,
    spread: 20,
    lastTradeTimestamp: 0,
    lastUpdateTimestamp: 0,
    ...overrides,
  };
}

const defaultProps = {
  onStatusChange: vi.fn(),
  onModeChange: vi.fn(),
  onSquareOff: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe("StrategyCard", () => {
  describe("rendering", () => {
    it("displays strategy name, type, symbol, and venue", () => {
      render(
        <StrategyCard strategy={makeStrategy()} {...defaultProps} />
      );

      expect(screen.getByText("Test Strategy")).toBeInTheDocument();
      expect(screen.getByText(/SimpleSpreadStrategy/)).toBeInTheDocument();
      expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
      expect(screen.getByText(/Binance/)).toBeInTheDocument();
    });

    it("shows status badge", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "RUNNING" })} {...defaultProps} />
      );

      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    it("shows MOCK badge for mock strategies", () => {
      render(
        <StrategyCard strategy={makeStrategy({ tradingMode: "MOCK" })} {...defaultProps} />
      );

      expect(screen.getByText("MOCK")).toBeInTheDocument();
    });

    it("shows LIVE badge for live strategies", () => {
      render(
        <StrategyCard strategy={makeStrategy({ tradingMode: "LIVE" })} {...defaultProps} />
      );

      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });

    it("displays live metrics when liveData is provided", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING" })}
          liveData={makeLiveData({ position: 5, unrealizedPnl: 100 })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Position")).toBeInTheDocument();
      expect(screen.getByText("Unrealized")).toBeInTheDocument();
      expect(screen.getByText("Realized")).toBeInTheDocument();
      expect(screen.getByText("Fills")).toBeInTheDocument();
    });

    it("does not display metrics when liveData is undefined", () => {
      render(
        <StrategyCard strategy={makeStrategy()} {...defaultProps} />
      );

      expect(screen.queryByText("Position")).not.toBeInTheDocument();
    });

    it("displays strategy parameters in human units", () => {
      // spreadOffset is stored in fixed-point (1e8); 100000000 == 1.0. The card
      // labels it "Spread" and renders the human value, not the raw integer.
      render(
        <StrategyCard
          strategy={makeStrategy({ params: { spreadOffset: 100000000 } })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Spread")).toBeInTheDocument();
      expect(screen.getByText("1.00")).toBeInTheDocument();
      expect(screen.queryByText("spreadOffset")).not.toBeInTheDocument();
    });

    it("displays risk limit badges when set", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ maxPositionLimit: 10, maxDrawdown: 5000 })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("MaxPos: 10")).toBeInTheDocument();
    });
  });

  describe("status transitions", () => {
    it("shows Start button for PENDING strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "PENDING" })} {...defaultProps} />
      );

      expect(screen.getByText("Start")).toBeInTheDocument();
    });

    it("shows Resume and Stop buttons for PAUSED strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "PAUSED" })} {...defaultProps} />
      );

      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
    });

    it("shows Pause and Stop buttons for RUNNING strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "RUNNING" })} {...defaultProps} />
      );

      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
    });

    it("shows no transition buttons for STOPPED strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "STOPPED" })} {...defaultProps} />
      );

      expect(screen.queryByText("Start")).not.toBeInTheDocument();
      expect(screen.queryByText("Resume")).not.toBeInTheDocument();
      expect(screen.queryByText("Pause")).not.toBeInTheDocument();
      expect(screen.queryByText("Stop")).not.toBeInTheDocument();
    });
  });

  describe("confirmation flow", () => {
    it("shows confirmation prompt when Start is clicked", async () => {
      const user = userEvent.setup();
      render(
        <StrategyCard strategy={makeStrategy({ status: "PENDING" })} {...defaultProps} />
      );

      await user.click(screen.getByText("Start"));

      expect(screen.getByText("Confirm")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("calls onStatusChange with RUNNING on confirm", async () => {
      const onStatusChange = vi.fn();
      const user = userEvent.setup();
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "PENDING" })}
          {...defaultProps}
          onStatusChange={onStatusChange}
        />
      );

      await user.click(screen.getByText("Start"));
      await user.click(screen.getByText("Confirm"));

      expect(onStatusChange).toHaveBeenCalledWith("strat-1", "RUNNING");
    });

    it("dismisses confirmation on Cancel click", async () => {
      const user = userEvent.setup();
      render(
        <StrategyCard strategy={makeStrategy({ status: "PENDING" })} {...defaultProps} />
      );

      await user.click(screen.getByText("Start"));
      expect(screen.getByText("Confirm")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
      expect(screen.getByText("Start")).toBeInTheDocument();
    });
  });

  describe("square off", () => {
    it("shows Square Off button when strategy has open position", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING" })}
          liveData={makeLiveData({ position: 500 })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Square Off")).toBeInTheDocument();
    });

    it("shows Square Off even when position is 0", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING" })}
          liveData={makeLiveData({ position: 0 })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Square Off")).toBeInTheDocument();
    });

    it("shows Square Off even when no liveData", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "RUNNING" })} {...defaultProps} />
      );

      expect(screen.getByText("Square Off")).toBeInTheDocument();
    });

    it("does not show Square Off for STOPPED strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "STOPPED" })} {...defaultProps} />
      );

      expect(screen.queryByText("Square Off")).not.toBeInTheDocument();
    });

    it("does not show Square Off for PENDING strategy", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "PENDING" })} {...defaultProps} />
      );

      expect(screen.queryByText("Square Off")).not.toBeInTheDocument();
    });

    it("shows confirmation message about market orders", async () => {
      const user = userEvent.setup();
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING" })}
          liveData={makeLiveData({ position: 500 })}
          {...defaultProps}
        />
      );

      await user.click(screen.getByText("Square Off"));

      expect(screen.getByText(/market order/i)).toBeInTheDocument();
    });

    it("calls onSquareOff on confirm", async () => {
      const onSquareOff = vi.fn();
      const user = userEvent.setup();
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING" })}
          liveData={makeLiveData({ position: 500 })}
          {...defaultProps}
          onSquareOff={onSquareOff}
        />
      );

      await user.click(screen.getByText("Square Off"));
      await user.click(screen.getByText("Confirm"));

      expect(onSquareOff).toHaveBeenCalledWith("strat-1");
    });
  });

  describe("mode switching", () => {
    it("shows Go Live button for MOCK non-STOPPED strategies", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "RUNNING", tradingMode: "MOCK" })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Go Live")).toBeInTheDocument();
    });

    it("does not show Go Live for STOPPED MOCK strategies", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "STOPPED", tradingMode: "MOCK" })}
          {...defaultProps}
        />
      );

      expect(screen.queryByText("Go Live")).not.toBeInTheDocument();
    });

    it("shows Switch to Mock for LIVE STOPPED strategies", () => {
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "STOPPED", tradingMode: "LIVE" })}
          {...defaultProps}
        />
      );

      expect(screen.getByText("Switch to Mock")).toBeInTheDocument();
    });
  });

  describe("delete", () => {
    it("shows Delete for STOPPED strategies", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "STOPPED" })} {...defaultProps} />
      );

      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("shows Delete for PENDING strategies", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "PENDING" })} {...defaultProps} />
      );

      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("does not show Delete for RUNNING strategies", () => {
      render(
        <StrategyCard strategy={makeStrategy({ status: "RUNNING" })} {...defaultProps} />
      );

      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    it("calls onDelete on confirm", async () => {
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(
        <StrategyCard
          strategy={makeStrategy({ status: "STOPPED" })}
          {...defaultProps}
          onDelete={onDelete}
        />
      );

      await user.click(screen.getByText("Delete"));
      expect(screen.getByText(/Delete this strategy/)).toBeInTheDocument();
      await user.click(screen.getByText("Confirm"));

      expect(onDelete).toHaveBeenCalledWith("strat-1");
    });
  });
});
