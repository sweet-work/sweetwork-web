import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
