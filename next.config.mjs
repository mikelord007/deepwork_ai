/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // In dev, avoid caching so normal refresh (F5) loads latest code (fixes map/state after Refresh button)
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
