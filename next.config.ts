import type { NextConfig } from "next";

const root = new URL(".", import.meta.url).pathname;

const config: NextConfig = {
  // This app lives inside a larger repo; keep Next from treating the parent folder as the project root.
  turbopack: { root },
  outputFileTracingRoot: root,
  // postgres.js and stripe run on the server only.
  serverExternalPackages: ["postgres", "stripe"],
  devIndicators: false,
};

export default config;
