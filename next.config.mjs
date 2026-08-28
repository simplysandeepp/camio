/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Camio is meant to run on a home machine, not a CDN. Keep it lean.
  poweredByHeader: false,
};

export default nextConfig;
