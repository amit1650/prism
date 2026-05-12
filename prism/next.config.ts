import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-mode "N" indicator overlay so the chat shell looks identical
  // in dev and prod. No functional effect.
  devIndicators: false,
};

export default nextConfig;
