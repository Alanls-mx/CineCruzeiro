const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_BASE_PATH || "").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  ...(configuredBasePath ? { basePath: configuredBasePath, assetPrefix: configuredBasePath } : {}),
  async rewrites() {
    const backendUrl =
      process.env.CINE_BACKEND_URL ||
      process.env.NEXT_PUBLIC_CINE_API_URL ||
      "http://localhost:4000";
    return [
      {
        source: "/uploads/:path*",
        destination: `${backendUrl.replace(/\/+$/, "")}/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "br.web.img3.acsta.net",
      },
      {
        protocol: "https",
        hostname: "www.guiadasemana.com.br",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "imgur.com",
      },
    ],
  },
};

export default nextConfig;
