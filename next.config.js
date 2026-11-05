/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://in.heycatch.ai",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://res.cloudinary.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://api.stripe.com https://api.cloudinary.com https://in.heycatch.ai",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self'",
              "media-src 'self' https://res.cloudinary.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // HeyCatch channel-attribution short links -- single lowercase-letter or
  // digit paths are reserved by HeyCatch; confirmed no real route in
  // src/pages uses one (checked 2026-10-22, no top-level single-character
  // file/dir and no catch-all route exists). If a real single-character
  // route is ever added, exclude it from this regex first.
  async redirects() {
    return [
      // Old pricing-plan checkout link (specific plan + checkout flow) → join page.
      {
        source: "/pricing-plans/plan-customization",
        has: [
          { type: "query", key: "planId", value: "684fe0c4-0743-41bb-a7ad-c25514cc9694" },
          { type: "query", key: "checkoutFlowId", value: "0e61663f-ebec-4365-9e82-03a3f823b661" },
        ],
        destination: "/join",
        permanent: true,
      },
      {
        source: "/:l([a-z0-9])",
        destination: "/?utm_source=heycatch&utm_campaign=:l",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
