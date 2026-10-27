import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The assistant's agent runtime loads Node built-ins (node:fs, node:os) dynamically, which webpack
  // can't bundle; load it from node_modules at runtime instead.
  serverExternalPackages: ["@mariozechner/pi-ai", "@mariozechner/pi-agent-core"],
};

export default nextConfig;
