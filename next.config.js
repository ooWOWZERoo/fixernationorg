/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for cPanel/Passenger Node.js deployment.
  // Produces a self-contained .next/standalone directory.
  output: "standalone",

  poweredByHeader: false,

  experimental: {
    // CloudLinux shared hosting enforces a per-user process limit.
    // cpus: 1 tells Next.js to use a single static-generation worker
    // instead of spawning one per CPU core, avoiding EAGAIN errors on build.
    cpus: 1,
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
