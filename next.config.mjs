/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This dashboard does not need Next's image optimizer. Disabling it reduces attack surface
  // (and avoids any disk-cache growth concerns) when self-hosting.
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://mind6857.space https://*.pages.dev https://*.vercel.app;"
          }
        ]
      }
    ];
  },
};

export default nextConfig;
