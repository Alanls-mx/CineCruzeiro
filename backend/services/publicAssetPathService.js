function createPublicAssetPathService({ getFirstEnv, frontendUrlEnvKeys, getEnv = () => process.env }) {
  function configuredAppBasePath() {
    const env = getEnv();
    let raw = String(env.NEXT_PUBLIC_BASE_PATH || env.NEXT_BASE_PATH || env.APP_BASE_PATH || "").trim();
    if (!raw) {
      const publicUrl = String(env.CINE_PUBLIC_BACKEND_URL || env.FRONTEND_URL || "").trim();
      try {
        raw = new URL(publicUrl).pathname;
      } catch {
        raw = "";
      }
    }
    if (!raw || raw === "/") return "";
    return `/${raw.replace(/^\/+|\/+$/g, "")}`;
  }

  function publicAssetUrl(url) {
    const value = String(url || "");
    const basePath = configuredAppBasePath();
    if (!basePath || !value.startsWith("/uploads/")) return value;
    return `${basePath}${value}`;
  }

  function storedAssetUrl(url) {
    const value = String(url || "").trim();
    const basePath = configuredAppBasePath();
    if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
    return value;
  }

  function storedLocalUploadUrl(url) {
    const value = storedAssetUrl(url);
    return value.startsWith("/uploads/") ? value : "";
  }

  function storedEditorialImageUrl(url) {
    const value = storedAssetUrl(url);
    if (value.startsWith("/uploads/")) return value;
    if (/^\/images\/cinema-editorial\/(cine-estacao-amparo|cinemax-piraju|cine-gama|cinemania-cosmopolis)\/(club-hero|club-banner|events-hero|events-games|events-parties|events-corporate|events-gallery)\.webp$/.test(value)) return value;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname === "images.unsplash.com" ? value : "";
    } catch {
      return "";
    }
  }

  function stripPublicAssetBase(pathname) {
    const value = String(pathname || "");
    const basePath = configuredAppBasePath();
    if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
    return value;
  }

  function appFrontendUrl() {
    const raw = (getFirstEnv(frontendUrlEnvKeys)?.value || "http://localhost:3000").replace(/\/+$/, "");
    const basePath = configuredAppBasePath();
    if (!basePath || raw.endsWith(basePath)) return raw;
    return `${raw}${basePath}`;
  }

  return { configuredAppBasePath, publicAssetUrl, storedAssetUrl, storedLocalUploadUrl,
    storedEditorialImageUrl, stripPublicAssetBase, appFrontendUrl };
}

module.exports = { createPublicAssetPathService };
