import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  : "https://lumixengine.com";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "/projects/cinecruzeiro").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: `${basePath}/`,
      disallow: [`${basePath}/admin`, `${basePath}/api`, `${basePath}/checkout`, `${basePath}/conta`],
    },
    sitemap: `${origin}${basePath}/sitemap.xml`,
  };
}
