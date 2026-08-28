/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
  // Camio is meant to run on a home machine, not a CDN. Keep it lean.
  poweredByHeader: false,

  // Dev server only: without this, Next 15 flags requests to /_next/* assets
  // as cross-origin when the dev server is reached via a LAN/Tailscale IP
  // instead of localhost (exactly Camio's case), and will start blocking
  // them outright in a future major version. Set DEV_ALLOWED_ORIGINS to a
  // comma-separated list of the host/IP(s) you use to reach `npm run dev`
  // (e.g. your Tailscale IP) — see .env.example.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),

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
            //
            // 'unsafe-eval' is added ONLY in dev: Next's dev server bundles
            // modules with eval()-based source maps for fast refresh, and a
            // strict CSP silently blocks all of it — the page renders but
            // every click does nothing (no console-visible error on most
            // mobile browsers). Never enabled in production builds.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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
