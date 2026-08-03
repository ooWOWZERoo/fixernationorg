/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for cPanel/Passenger Node.js deployment.
  // Produces a self-contained .next/standalone directory.
  output: "standalone",

  poweredByHeader: false,

  experimental: {
    // CloudLinux shared hosting enforces a per-user process limit.
    // Both options limit parallel worker spawning to avoid EAGAIN on build:
    // cpus: 1            — static page generation workers (default = CPU count)
    // outputFileTracingConcurrentWorkers: 1 — nft tracing workers (default = 4)
    cpus: 1,
    outputFileTracingConcurrentWorkers: 1,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
