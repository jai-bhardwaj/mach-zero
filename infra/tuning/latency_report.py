#!/usr/bin/env python3
"""
Parse latency benchmark output and generate histograms/percentile plots.
Usage: ./latency_report.py [latency_data.csv]
"""

import sys
import numpy as np


def load_data(filename):
    """Load nanosecond latency samples from CSV (one value per line)."""
    return np.loadtxt(filename, delimiter=",")


def compute_stats(data):
    """Compute latency statistics."""
    return {
        "count": len(data),
        "min": np.min(data),
        "max": np.max(data),
        "mean": np.mean(data),
        "median": np.median(data),
        "stddev": np.std(data),
        "p50": np.percentile(data, 50),
        "p90": np.percentile(data, 90),
        "p95": np.percentile(data, 95),
        "p99": np.percentile(data, 99),
        "p999": np.percentile(data, 99.9),
    }


def format_ns(ns):
    """Format nanoseconds to human-readable."""
    if ns < 1000:
        return f"{ns:.0f} ns"
    elif ns < 1_000_000:
        return f"{ns / 1000:.2f} us"
    elif ns < 1_000_000_000:
        return f"{ns / 1_000_000:.2f} ms"
    return f"{ns / 1_000_000_000:.2f} s"


def print_report(stats, label="Latency"):
    """Print formatted latency report."""
    print(f"\n=== {label} Report ({stats['count']} samples) ===")
    print(f"  Min:    {format_ns(stats['min'])}")
    print(f"  Mean:   {format_ns(stats['mean'])}")
    print(f"  Median: {format_ns(stats['median'])}")
    print(f"  p90:    {format_ns(stats['p90'])}")
    print(f"  p95:    {format_ns(stats['p95'])}")
    print(f"  p99:    {format_ns(stats['p99'])}")
    print(f"  p99.9:  {format_ns(stats['p999'])}")
    print(f"  Max:    {format_ns(stats['max'])}")
    print(f"  Stddev: {format_ns(stats['stddev'])}")


def plot_histogram(data, label="Latency"):
    """Plot latency histogram if matplotlib is available."""
    try:
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))

        # Linear histogram
        axes[0].hist(data / 1000, bins=100, color="steelblue", edgecolor="white", linewidth=0.3)
        axes[0].set_xlabel("Latency (us)")
        axes[0].set_ylabel("Count")
        axes[0].set_title(f"{label} Distribution")
        axes[0].axvline(np.percentile(data / 1000, 99), color="red", linestyle="--", label="p99")
        axes[0].legend()

        # Log-scale CDF
        sorted_data = np.sort(data / 1000)
        cdf = np.arange(1, len(sorted_data) + 1) / len(sorted_data)
        axes[1].plot(sorted_data, cdf * 100, color="steelblue", linewidth=0.8)
        axes[1].set_xscale("log")
        axes[1].set_xlabel("Latency (us, log scale)")
        axes[1].set_ylabel("Percentile (%)")
        axes[1].set_title(f"{label} CDF")
        axes[1].axhline(y=99, color="red", linestyle="--", alpha=0.5, label="p99")
        axes[1].axhline(y=99.9, color="orange", linestyle="--", alpha=0.5, label="p99.9")
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig("latency_report.png", dpi=150)
        print("\nHistogram saved to latency_report.png")
        plt.show()
    except ImportError:
        print("\nmatplotlib not installed, skipping plots")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Generate synthetic data for demo
        print("No input file specified, using synthetic data")
        np.random.seed(42)
        data = np.random.lognormal(mean=np.log(500), sigma=0.5, size=100000)
    else:
        data = load_data(sys.argv[1])

    stats = compute_stats(data)
    print_report(stats, "Tick-to-Trade")
    plot_histogram(data, "Tick-to-Trade")
