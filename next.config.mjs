/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Camio is meant to run on a home machine, not a CDN. Keep it lean.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: the live camera must never be framed by another site.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            // Defense-in-depth CSP. 'unsafe-inline' style is needed for the
            // inline styles; scripts are same-origin (Next). media/connect allow
            // the same-origin proxied stream + WebRTC.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
