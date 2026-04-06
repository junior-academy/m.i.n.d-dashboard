/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This dashboard does not need Next's image optimizer. Disabling it reduces attack surface
  // (and avoids any disk-cache growth concerns) when self-hosting.
  images: {
    unoptimized: true
  }
};

export default nextConfig;
