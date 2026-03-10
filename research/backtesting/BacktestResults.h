#pragma once

#include <cstdint>
#include <cmath>
#include <vector>
#include <algorithm>
#include <numeric>
#include <iostream>
#include <iomanip>

namespace mach_zero::backtest {

// Tracks P&L and computes performance statistics.
class BacktestResults {
public:
    void recordFill(int64_t pnlDelta) {
        totalPnl_ += pnlDelta;
        fills_.push_back(pnlDelta);

        if (pnlDelta > 0) ++wins_;
        else if (pnlDelta < 0) ++losses_;

        // Track equity curve for drawdown
        equity_.push_back(totalPnl_);
        peakEquity_ = std::max(peakEquity_, totalPnl_);
        int64_t drawdown = peakEquity_ - totalPnl_;
        maxDrawdown_ = std::max(maxDrawdown_, drawdown);
    }

    void recordTrade() { ++totalTrades_; }

    // Statistics
    int64_t totalPnl() const { return totalPnl_; }
    double totalPnlDecimal() const { return static_cast<double>(totalPnl_) / 100000000.0; }

    uint64_t totalTrades() const { return totalTrades_; }
    uint64_t totalFills() const { return fills_.size(); }
    uint64_t wins() const { return wins_; }
    uint64_t losses() const { return losses_; }

    double winRate() const {
        return fills_.empty() ? 0.0 : static_cast<double>(wins_) / fills_.size();
    }

    int64_t maxDrawdown() const { return maxDrawdown_; }
    double maxDrawdownDecimal() const { return static_cast<double>(maxDrawdown_) / 100000000.0; }

    double sharpeRatio(double annualizationFactor = 252.0) const {
        if (fills_.size() < 2) return 0.0;

        double mean = std::accumulate(fills_.begin(), fills_.end(), 0.0) / fills_.size();

        double variance = 0.0;
        for (auto pnl : fills_) {
            double diff = static_cast<double>(pnl) - mean;
            variance += diff * diff;
        }
        variance /= (fills_.size() - 1);
        double stddev = std::sqrt(variance);

        if (stddev == 0.0) return 0.0;
        return (mean / stddev) * std::sqrt(annualizationFactor);
    }

    double profitFactor() const {
        int64_t grossProfit = 0, grossLoss = 0;
        for (auto pnl : fills_) {
            if (pnl > 0) grossProfit += pnl;
            else grossLoss += -pnl;
        }
        return grossLoss > 0 ? static_cast<double>(grossProfit) / grossLoss : 0.0;
    }

    void printSummary() const {
        std::cout << "\n=== Backtest Results ===" << std::endl;
        std::cout << "Total P&L:     " << std::fixed << std::setprecision(2)
                  << totalPnlDecimal() << std::endl;
        std::cout << "Trades:        " << totalTrades_ << std::endl;
        std::cout << "Fills:         " << fills_.size() << std::endl;
        std::cout << "Win/Loss:      " << wins_ << "/" << losses_ << std::endl;
        std::cout << "Win Rate:      " << std::setprecision(1)
                  << (winRate() * 100.0) << "%" << std::endl;
        std::cout << "Sharpe Ratio:  " << std::setprecision(2)
                  << sharpeRatio() << std::endl;
        std::cout << "Profit Factor: " << std::setprecision(2)
                  << profitFactor() << std::endl;
        std::cout << "Max Drawdown:  " << std::setprecision(2)
                  << maxDrawdownDecimal() << std::endl;
    }

    void reset() {
        totalPnl_ = 0;
        peakEquity_ = 0;
        maxDrawdown_ = 0;
        totalTrades_ = 0;
        wins_ = 0;
        losses_ = 0;
        fills_.clear();
        equity_.clear();
    }

private:
    int64_t totalPnl_ = 0;
    int64_t peakEquity_ = 0;
    int64_t maxDrawdown_ = 0;
    uint64_t totalTrades_ = 0;
    uint64_t wins_ = 0;
    uint64_t losses_ = 0;
    std::vector<int64_t> fills_;
    std::vector<int64_t> equity_;
};

} // namespace mach_zero::backtest
