const productionBasePath = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const configuredBasePath = (
  process.env.NEXT_PUBLIC_BASE_PATH ||
  process.env.NEXT_BASE_PATH ||
  productionBasePath
).replace(/\/+$/, "");
const configuredDistDir = process.env.NEXT_DIST_DIR || "";
const publicContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://accounts.google.com https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https: wss:${process.env.NODE_ENV === "production" ? "" : " ws:"}`,
  "frame-src 'self' https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://*.mercadopago.com https://*.mercadolibre.com",
  "worker-src 'self' blob:",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const publicSecurityHeaders = [
  { key: "Content-Security-Policy", value: publicContentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  ...(process.env.NODE_ENV !== "production" ? { allowedDevOrigins: ["127.0.0.1", "localhost", "172.24.16.1"] } : {}),
  ...(configuredDistDir ? { distDir: configuredDistDir } : {}),
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: publicSecurityHeaders,
      },
      {
        source: "/conta/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    minimumCacheTTL: 2678400,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 412, 520, 640, 750, 828, 1080, 1200, 1335, 1920],
    qualities: [40, 48, 58, 68, 72, 74, 75],
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
