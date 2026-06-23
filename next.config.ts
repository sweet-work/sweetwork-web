import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server bundle (.next/standalone) so the Docker image
  // can run `node server.js` without node_modules — keeps the image small.
  output: "standalone",

  // Proxy API calls through Next so the browser talks to the same origin —
  // avoids CORS since the upstream Render API doesn't send CORS headers.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://sweetwork-api.onrender.com/:path*",
      },
    ];
  },
};

export default nextConfig;
