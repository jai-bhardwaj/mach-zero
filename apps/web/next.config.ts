import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Disable the dev-tools indicator: it floats in a bottom corner and overlaps
  // real controls there — the sidebar Sign out/collapse (bottom-left) and the
  // table pagination (bottom-right). It's a dev-only overlay (never in prod),
  // so turning it off keeps those controls usable during development.
  devIndicators: false,
  // The notifications page moved under Settings (/settings/notifications) in the
  // settings restructure — it's the only route whose URL actually changed (the
  // others kept their top-level paths via a route group). Permanently redirect
  // the old top-level path so bookmarks/old links don't hit a 404.
  async redirects() {
    return [
      {
        source: "/notifications",
        destination: "/settings/notifications",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
