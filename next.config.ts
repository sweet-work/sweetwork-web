import type { NextConfig } from "next";

// Upstream API the /api/* proxy points at. Baked in at build time (Next compiles
// rewrites into the build, so this is read during `next build`, not at runtime).
// Defaults to the Render API; override with API_PROXY_TARGET for self-hosting
// (e.g. http://host.docker.internal:8000 to reach a local API container).
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "https://sweetwork-api.onrender.com";

const nextConfig: NextConfig = {
  // Build a self-contained server bundle (.next/standalone) so the Docker image
  // can run `node server.js` without node_modules — keeps the image small.
  output: "standalone",

  // Proxy API calls through Next so the browser talks to the same origin —
  // avoids CORS since the upstream API doesn't send CORS headers.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/:path*`,
      },
    ];
  },
};

export default nextConfig;
