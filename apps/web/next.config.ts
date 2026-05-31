import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Move the dev-tools indicator off the bottom-left so it stops overlapping
  // the sidebar's Sign out / collapse controls during development. (Dev-only;
  // never rendered in production.)
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
