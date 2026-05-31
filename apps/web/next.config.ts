import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable the dev-tools indicator: it floats in a bottom corner and overlaps
  // real controls there — the sidebar Sign out/collapse (bottom-left) and the
  // table pagination (bottom-right). It's a dev-only overlay (never in prod),
  // so turning it off keeps those controls usable during development.
  devIndicators: false,
};

export default nextConfig;
